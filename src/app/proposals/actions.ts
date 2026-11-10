"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SECTION_TEMPLATES } from "@/lib/proposal-meta";
import { aiErrorMessage } from "@/lib/ai/config";
import { AiError, type AiErrorCode } from "@/lib/ai/types";
import { generateProposalDraft } from "@/lib/proposals";
import { draftOutline, MIN_BRIEF_CHARS, type OutlineSection } from "@/lib/proposal-draft";
import { templateSections } from "@/lib/proposal-templates";
import { getMyOrganization } from "@/lib/project";
import type { ProposalStatus, ProposalType } from "@/lib/types";
import { permissionMessage } from "@/lib/permissions";

export type ActionState = { error?: string; ok?: boolean; message?: string; /** Changes on every success, to reset forms. */ nonce?: number };
export type GenState = { error?: string; ok?: boolean; code?: AiErrorCode };

/** Statuses in which content (sections, items, header) can be edited; the database agrees. */
const EDITABLE: readonly ProposalStatus[] = ["draft", "ai_generated", "changes_requested"];

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
  let type = (optional(formData, "proposal_type") ?? "technical_financial") as ProposalType;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { error: "انتهت الجلسة. سجّل الدخول من جديد." };

  // A template sets the type and the starting sections (headings only; bodies stay empty).
  const templateId = optional(formData, "template_id");
  let headings = SECTION_TEMPLATES[type];
  if (templateId) {
    const { data: template } = await supabase
      .from("proposal_templates").select("proposal_type, sections").eq("id", templateId).eq("organization_id", orgId).maybeSingle();
    if (!template) return { error: "القالب المختار غير موجود. حدّث الصفحة واختر من جديد." };
    type = template.proposal_type as ProposalType;
    const fromTemplate = templateSections(template.sections).map((s) => s.heading);
    headings = fromTemplate.length ? fromTemplate : SECTION_TEMPLATES[type];
  }

  const clientId = await resolveClient(supabase, orgId, optional(formData, "client_id"), optional(formData, "new_client"));
  // New proposals start with the organisation's default VAT (Settings); it stays editable per proposal.
  const { data: org } = await supabase.from("organizations").select("default_vat_rate").eq("id", orgId).maybeSingle();
  const vatRate = Number(org?.default_vat_rate);

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
      template_id: templateId,
      created_by: userId,
      ...(Number.isFinite(vatRate) ? { vat_rate: vatRate } : {}),
    })
    .select("id")
    .single();
  if (error) return { error: permissionMessage(error) };

  // Seed the section headings (empty) for a quick start.
  const rows = headings.map((h, i) => ({
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
  const force = formData.get("force") === "on";
  if (brief.length < MIN_BRIEF_CHARS) return { error: "الموجز قصير جدًا. ألصق موجز العميل أو متطلباته (30 حرفًا على الأقل)." };

  const supabase = await createClient();
  const { data: proposal } = await supabase
    .from("proposals").select("organization_id, status, proposal_type, client_id, template_id").eq("id", proposalId).maybeSingle();
  if (!proposal) return { error: "العرض غير موجود." };
  if (!EDITABLE.includes(proposal.status as ProposalStatus)) {
    return { error: "العرض قيد المراجعة أو معتمد، لذا محتواه مقفل. أعده إلى «مسودة» لتوليد محتوى جديد." };
  }
  const org = await getMyOrganization();
  if (!org || org.id !== proposal.organization_id || !org.access.sales) return { error: permissionMessage({ code: "42501" }) };

  let clientName = "";
  if (proposal.client_id) {
    const { data: c } = await supabase.from("clients").select("name").eq("id", proposal.client_id).maybeSingle();
    clientName = c?.name ?? "";
  }
  let templateOutline: OutlineSection[] | null = null;
  if (proposal.template_id) {
    const { data: t } = await supabase.from("proposal_templates").select("sections").eq("id", proposal.template_id).maybeSingle();
    templateOutline = templateSections(t?.sections);
  }
  const outline = draftOutline(proposal.proposal_type as ProposalType, templateOutline);

  let draft;
  try {
    draft = await generateProposalDraft(supabase, {
      proposalId, organizationId: proposal.organization_id, brief, type: proposal.proposal_type as ProposalType,
      company: org.name || companyName, client: clientName, outline, force,
    });
  } catch (e) {
    if (e instanceof AiError) return { error: e.message, code: e.code };
    console.error("generateDraft failed:", e);
    return { error: aiErrorMessage("failed"), code: "failed" };
  }

  // Written content is kept as a version before AI content replaces it.
  const { data: existing } = await supabase.from("proposal_sections").select("id, body").eq("proposal_id", proposalId);
  const old = (existing ?? []) as { id: string; body: string }[];
  if (old.some((s) => s.body.trim())) {
    const { error: vErr } = await supabase.rpc("save_proposal_version", { pid: proposalId, note: "قبل إعادة التوليد بالذكاء الاصطناعي" });
    if (vErr) return { error: permissionMessage(vErr) ?? "تعذّر حفظ نسخة من المحتوى الحالي، فلم يُستبدل." };
  }
  // New sections first, then the old ones go: a failed insert never leaves the proposal empty.
  const rows = draft.sections.map((s, i) => ({
    proposal_id: proposalId, organization_id: proposal.organization_id, heading: s.heading, body: s.body, ai_generated: true, sort_order: i,
  }));
  if (rows.length) {
    const { error: insErr } = await supabase.from("proposal_sections").insert(rows);
    if (insErr) return { error: permissionMessage(insErr) ?? "تعذّر حفظ المسودة." };
  }
  if (old.length) await supabase.from("proposal_sections").delete().in("id", old.map((s) => s.id));
  const { error: upErr } = await supabase
    .from("proposals")
    .update({ summary: draft.summary, brief, ...(proposal.status === "draft" ? { status: "ai_generated" as const } : {}) })
    .eq("id", proposalId);
  if (upErr) return { error: permissionMessage(upErr) };
  refresh();
  return { ok: true };
}

// ---------------- Review workflow ----------------

function workflowMessage(error: { code?: string; message?: string }): string {
  const msg = error.message ?? "";
  if (/approved internally before/i.test(msg)) return "يلزم اعتماد العرض داخليًا قبل إرساله للعميل أو تحويله.";
  if (/can approve a proposal/i.test(msg)) return "الاعتماد لمدير المنظمة أو المدير فقط، عبر المراجعة.";
  if (/under review can be approved|can only be requested/i.test(msg)) return "العرض لم يعد قيد المراجعة. حدّث الصفحة.";
  if (/rejected or expired/i.test(msg)) return "لا يُحوَّل عرض مرفوض أو منتهٍ إلى مشروع.";
  if (error.code === "23514") return "اكتب سبب طلب التعديلات حتى يعرف الفريق ما المطلوب.";
  return permissionMessage(error) ?? "تعذّر تنفيذ الإجراء.";
}

/** Moves a proposal along the workflow. The database decides who may make each move. */
export async function changeStatus(proposalId: string, to: ProposalStatus): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proposals").update({ status: to }).eq("id", proposalId).select("id");
  if (error) return { error: workflowMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true };
}

/** Records a review: a comment, a change request (needs a reason) or an approval. */
export async function reviewProposal(
  proposalId: string,
  orgId: string,
  version: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const decision = text(formData, "decision");
  if (!["comment", "changes_requested", "approved"].includes(decision)) return { error: "اختر نوع المراجعة." };
  const comment = text(formData, "comment").slice(0, 4000);
  if (decision === "comment" && !comment) return { error: "اكتب التعليق أولًا." };
  if (decision === "changes_requested" && !comment) return { error: "اكتب سبب طلب التعديلات حتى يعرف الفريق ما المطلوب." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("proposal_reviews")
    .insert({ proposal_id: proposalId, organization_id: orgId, version, decision, comment });
  if (error) return { error: workflowMessage(error) };
  refresh();
  return {
    ok: true,
    nonce: Date.now(),
    message: decision === "approved" ? "اعتُمد العرض داخليًا." : decision === "changes_requested" ? "أُعيد العرض للتعديل." : "أُضيف التعليق.",
  };
}

/** Saves the current content as a named version (sales). */
export async function saveVersion(proposalId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const note = text(formData, "note").slice(0, 500);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_proposal_version", { pid: proposalId, note });
  if (error) return { error: permissionMessage(error) };
  refresh();
  return { ok: true, nonce: Date.now(), message: `حُفظت النسخة ${data}.` };
}

// ---------------- Convert to project ----------------

/** Creates the project and its BOQ in one database transaction (see convert_proposal_to_project). */
export async function convertToProject(proposalId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_proposal_to_project", { pid: proposalId });
  if (error || !data) return { error: error ? workflowMessage(error) : "تعذّر تحويل العرض." };
  redirect(`/projects/${data as string}`);
}
