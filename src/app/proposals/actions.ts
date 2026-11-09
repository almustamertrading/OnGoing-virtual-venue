"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SECTION_TEMPLATES } from "@/lib/proposal-meta";
import { generateProposalDraft, ProposalConfigError } from "@/lib/proposals";
import type { ProposalStatus, ProposalType } from "@/lib/types";
import { permissionMessage } from "@/lib/permissions";

export type ActionState = { error?: string; ok?: boolean };
export type GenState = { error?: string; ok?: boolean };

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => text(f, k) || null;
const num = (f: FormData, k: string) => {
  const raw = text(f, k).replace(/[, ]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

async function resolveClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  clientId: string | null,
  newName: string | null,
) {
  if (newName) {
    const { data: existing } = await supabase
      .from("clients").select("id").eq("organization_id", orgId).ilike("name", newName).maybeSingle();
    if (existing) return existing.id as string;
    const { data } = await supabase.from("clients").insert({ organization_id: orgId, name: newName }).select("id").single();
    return (data?.id as string) ?? null;
  }
  return clientId;
}

export async function createProposal(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const title = text(formData, "title");
  if (!title) return { error: "اكتب عنوان العرض." };
  const type = (optional(formData, "proposal_type") ?? "technical_financial") as ProposalType;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { error: "انتهت الجلسة. سجّل الدخول من جديد." };

  const clientId = await resolveClient(supabase, orgId, optional(formData, "client_id"), optional(formData, "new_client"));

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      organization_id: orgId,
      title,
      proposal_type: type,
      client_id: clientId,
      owner_id: userId,
      issue_date: optional(formData, "issue_date"),
      due_date: optional(formData, "due_date"),
      valid_until: optional(formData, "valid_until"),
      brief: text(formData, "brief"),
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return { error: permissionMessage(error) };

  // Seed the type's suggested section headings (empty) for a quick start.
  const rows = SECTION_TEMPLATES[type].map((h, i) => ({
    proposal_id: data.id, organization_id: orgId, heading: h, body: "", sort_order: i,
  }));
  if (rows.length) await supabase.from("proposal_sections").insert(rows);

  redirect(`/proposals/${data.id}`);
}

export async function updateProposal(
  id: string,
  patch: { title?: string; status?: ProposalStatus; summary?: string; vat_rate?: number; client_id?: string | null; issue_date?: string | null; due_date?: string | null; valid_until?: string | null },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("proposals").update(patch).eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

export async function deleteProposal(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proposals").delete().eq("id", id).select("id");
  if (error) throw new Error(permissionMessage(error));
  // RLS hides rows the user may not delete, so "nothing deleted" means "not allowed".
  if (!data?.length) throw new Error("ليست لديك صلاحية لحذف هذا العرض.");
  redirect("/proposals");
}

// ---------------- Sections ----------------

export async function addSection(proposalId: string, orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const heading = text(formData, "heading");
  if (!heading) return { error: "اكتب عنوان القسم." };
  const supabase = await createClient();
  const { error } = await supabase.from("proposal_sections").insert({
    proposal_id: proposalId, organization_id: orgId, heading, body: text(formData, "body"), sort_order: Date.now(),
  });
  if (error) return { error: permissionMessage(error) };
  refresh();
  return { ok: true };
}

export async function updateSection(id: string, patch: { heading?: string; body?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("proposal_sections").update(patch).eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

export async function deleteSection(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proposal_sections").delete().eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

// ---------------- Financial items (BOQ) ----------------

export async function addItem(proposalId: string, orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const description = text(formData, "description");
  if (!description) return { error: "اكتب وصف البند." };
  const supabase = await createClient();
  const { error } = await supabase.from("proposal_items").insert({
    proposal_id: proposalId,
    organization_id: orgId,
    category: text(formData, "category"),
    description,
    unit: text(formData, "unit"),
    quantity: num(formData, "quantity") ?? 1,
    unit_price: num(formData, "unit_price") ?? 0,
    is_optional: text(formData, "is_optional") === "on",
    sort_order: Date.now(),
  });
  if (error) return { error: permissionMessage(error) };
  refresh();
  return { ok: true };
}

export async function updateItem(
  id: string,
  patch: { category?: string; description?: string; unit?: string; quantity?: number; unit_price?: number; is_optional?: boolean },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("proposal_items").update(patch).eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

/** Internal unit cost of an item. Finance only; the database refuses anyone else. */
export async function setItemCost(itemId: string, orgId: string, unitCost: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("proposal_item_costs")
    .upsert({ item_id: itemId, organization_id: orgId, unit_cost: unitCost }, { onConflict: "item_id,organization_id" });
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

export async function deleteItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proposal_items").delete().eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

// ---------------- AI generation ----------------

export async function generateDraft(
  proposalId: string,
  orgId: string,
  companyName: string,
  _prev: GenState,
  formData: FormData,
): Promise<GenState> {
  const brief = text(formData, "brief");
  const supabase = await createClient();
  const { data: proposal } = await supabase
    .from("proposals").select("proposal_type, client_id").eq("id", proposalId).maybeSingle();
  if (!proposal) return { error: "العرض غير موجود." };

  let clientName = "";
  if (proposal.client_id) {
    const { data: c } = await supabase.from("clients").select("name").eq("id", proposal.client_id).maybeSingle();
    clientName = c?.name ?? "";
  }

  try {
    const draft = await generateProposalDraft(brief, proposal.proposal_type as ProposalType, companyName, clientName);
    // Replace existing sections with the generated ones.
    await supabase.from("proposal_sections").delete().eq("proposal_id", proposalId);
    const rows = draft.sections.map((s, i) => ({
      proposal_id: proposalId, organization_id: orgId, heading: s.heading, body: s.body, ai_generated: true, sort_order: i,
    }));
    if (rows.length) await supabase.from("proposal_sections").insert(rows);
    await supabase.from("proposals").update({ summary: draft.summary, brief, status: "ai_generated" }).eq("id", proposalId);
  } catch (e) {
    if (e instanceof ProposalConfigError) return { error: e.message };
    return { error: (e as Error).message || "تعذّر توليد المسودة." };
  }
  refresh();
  return { ok: true };
}

// ---------------- Convert to project ----------------

export async function convertToProject(proposalId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) throw new Error("انتهت الجلسة.");

  const { data: p } = await supabase.from("proposals").select("*").eq("id", proposalId).maybeSingle();
  if (!p) throw new Error("العرض غير موجود.");
  if (p.project_id) redirect(`/projects/${p.project_id}`);

  const { data: items } = await supabase.from("proposal_items").select("*").eq("proposal_id", proposalId).order("sort_order");
  const list = items ?? [];
  const budget = list
    .filter((i) => !i.is_optional)
    .reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      organization_id: p.organization_id,
      name: p.title,
      client_id: p.client_id,
      description: p.summary,
      status: "confirmed",
      budget: budget || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(permissionMessage(error));

  if (list.length) {
    await supabase.from("boq_items").insert(
      list.map((i, idx) => ({
        project_id: project.id,
        description: i.description,
        unit: i.unit,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        sort_order: idx,
      })),
    );
  }
  await supabase.from("proposals").update({ status: "converted", project_id: project.id }).eq("id", proposalId);
  redirect(`/projects/${project.id}`);
}
