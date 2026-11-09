"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, ProjectStatus, ProjectType } from "@/lib/types";
import { AiError } from "@/lib/ai/types";
import { getMyOrganization } from "@/lib/project";
import { extractRfpFromPdf, type ExtractedRfp } from "@/lib/rfp";
import { permissionMessage } from "@/lib/permissions";

export type ActionState = { error?: string; ok?: boolean };
export type RfpState = { data?: ExtractedRfp; error?: string };

const DEFAULT_LAYERS = [
  { name: "Perimeter & security", color: "#ef4444" },
  { name: "Crowd flow", color: "#f59e0b" },
  { name: "Hospitality", color: "#a855f7" },
  { name: "Broadcast & media", color: "#3b82f6" },
  { name: "Logistics & power", color: "#10b981" },
];

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => text(f, k) || null;

function money(f: FormData, k: string) {
  const raw = text(f, k).replace(/[, ]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

type ClientContact = {
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

const validDate = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Finds or creates a client by name inside the organisation. */
async function resolveClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  clientId: string | null,
  newClientName: string | null,
  contact?: ClientContact,
) {
  if (newClientName) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("name", newClientName)
      .maybeSingle();
    if (existing) return { id: existing.id as string };
    const { data, error } = await supabase
      .from("clients")
      .insert({ organization_id: organizationId, name: newClientName, ...(contact ?? {}) })
      .select("id")
      .single();
    if (error) return { error: permissionMessage(error) };
    return { id: data.id as string };
  }
  return { id: clientId };
}

/** Inserts the AI-drafted blueprint (BOQ, KPIs, plan phases, team roles) for a new project. */
async function saveBlueprint(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  raw: string,
) {
  if (!raw) return;
  let bp: {
    boq?: { description?: string; unit?: string; quantity?: number | null }[];
    evaluation?: { criterion?: string; weight?: number | null }[];
    plan?: { title?: string; objective?: string; start_date?: string | null; end_date?: string | null }[];
    team?: { title?: string; responsibility?: string; headcount?: number }[];
  };
  try {
    bp = JSON.parse(raw);
  } catch {
    return; // ignore malformed import payload; the project is already created
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

  const boq = (bp.boq ?? [])
    .filter((x) => x?.description?.trim())
    .slice(0, 150)
    .map((x, i) => ({
      project_id: projectId,
      description: x.description!.trim().slice(0, 500),
      unit: (x.unit ?? "").trim().slice(0, 60),
      quantity: num(x.quantity),
      sort_order: i,
    }));
  if (boq.length) await supabase.from("boq_items").insert(boq);

  const kpi = (bp.evaluation ?? [])
    .filter((x) => x?.criterion?.trim())
    .slice(0, 80)
    .map((x, i) => ({
      project_id: projectId,
      criterion: x.criterion!.trim().slice(0, 500),
      weight: num(x.weight),
      sort_order: i,
    }));
  if (kpi.length) await supabase.from("evaluation_criteria").insert(kpi);

  const plan = (bp.plan ?? [])
    .filter((x) => x?.title?.trim())
    .slice(0, 20)
    .map((x, i) => ({
      project_id: projectId,
      title: x.title!.trim().slice(0, 300),
      objective: (x.objective ?? "").trim().slice(0, 1000),
      start_date: validDate(x.start_date),
      end_date: validDate(x.end_date),
      sort_order: i,
    }));
  if (plan.length) await supabase.from("plan_phases").insert(plan);

  const team = (bp.team ?? [])
    .filter((x) => x?.title?.trim())
    .slice(0, 50)
    .map((x, i) => ({
      project_id: projectId,
      title: x.title!.trim().slice(0, 200),
      responsibility: (x.responsibility ?? "").trim().slice(0, 1000),
      headcount: Math.max(0, Math.round(Number(x.headcount) || 1)),
      sort_order: i,
    }));
  if (team.length) await supabase.from("team_roles").insert(team);
}

export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = text(formData, "name");
  const organizationId = text(formData, "organization_id");
  if (!name) return { error: "Give the project a name." };
  if (!organizationId) return { error: "Your account is not part of an organisation yet." };
  const budget = money(formData, "budget");
  if (Number.isNaN(budget)) return { error: "Budget must be a positive number." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: "You are signed out. Sign in again." };

  const client = await resolveClient(
    supabase,
    organizationId,
    optional(formData, "client_id"),
    optional(formData, "new_client"),
    {
      contact_name: optional(formData, "client_contact_name"),
      email: optional(formData, "client_email"),
      phone: optional(formData, "client_phone"),
      address: optional(formData, "client_address"),
    },
  );
  if ("error" in client) return { error: client.error };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      organization_id: organizationId,
      name,
      client_id: client.id,
      description: optional(formData, "description"),
      project_type: (optional(formData, "project_type") ?? "other") as ProjectType,
      status: (optional(formData, "status") ?? "lead") as ProjectStatus,
      location: optional(formData, "location"),
      budget,
      start_date: optional(formData, "start_date"),
      end_date: optional(formData, "end_date"),
      rfp_reference: optional(formData, "rfp_reference"),
      submission_method: optional(formData, "submission_method"),
      submission_location: optional(formData, "submission_location"),
      submission_deadline: optional(formData, "submission_deadline"),
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return { error: permissionMessage(error) };

  // Scope and deliverables carried over from an RFP import.
  const itemsRaw = String(formData.get("items_json") ?? "");
  if (itemsRaw) {
    try {
      const items = JSON.parse(itemsRaw) as { kind: "scope" | "deliverable"; title: string }[];
      const rows = items
        .filter((i) => i && typeof i.title === "string" && i.title.trim())
        .slice(0, 40)
        .map((i, idx) => ({
          project_id: data.id,
          kind: i.kind === "deliverable" ? "deliverable" : "scope",
          title: i.title.trim().slice(0, 300),
          sort_order: idx,
        }));
      if (rows.length) await supabase.from("scope_items").insert(rows);
    } catch {
      // ignore malformed import payload; the project is already created
    }
  }

  // Pricing, KPIs, plan phases and team roles drafted from the RFP.
  await saveBlueprint(supabase, data.id, String(formData.get("blueprint_json") ?? ""));

  redirect(`/projects/${data.id}`);
}

/**
 * Reads an RFP PDF the browser already uploaded to the `rfp-uploads` bucket and
 * returns extracted project fields for review. The file is uploaded straight to
 * storage (not through this action) so it is not bound by the serverless
 * request-size limit; here we only receive its storage path.
 */
export async function extractRfp(_prev: RfpState, formData: FormData): Promise<RfpState> {
  const path = String(formData.get("path") ?? "").trim();
  if (!path || !path.toLowerCase().endsWith(".pdf")) return { error: "أرفق ملف RFP بصيغة PDF." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return { error: "انتهت الجلسة. سجّل الدخول من جديد." };
  if (!path.startsWith(`${uid}/`)) return { error: "مسار الملف غير صالح." };

  try {
    const { data: blob, error: dlError } = await supabase.storage
      .from("rfp-uploads")
      .download(path);
    if (dlError || !blob) return { error: "تعذّر قراءة الملف المرفوع. حاول مجددًا." };

    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const org = await getMyOrganization();
    const data = await extractRfpFromPdf(supabase, base64, org?.id ?? null);
    return { data };
  } catch (e) {
    if (e instanceof AiError) return { error: e.message };
    console.error("extractRfp failed:", e);
    return { error: "تعذّرت قراءة الملف. حاول مجددًا." };
  } finally {
    // Best-effort cleanup of the temporary upload.
    try {
      await supabase.storage.from("rfp-uploads").remove([path]);
    } catch {
      // leave the temp file; a storage lifecycle rule can sweep it later
    }
  }
}

export async function updateProject(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = text(formData, "name");
  if (!name) return { error: "The project needs a name." };
  const budget = money(formData, "budget");
  if (Number.isNaN(budget)) return { error: "Budget must be a positive number." };

  const supabase = await createClient();
  const organizationId = text(formData, "organization_id");
  const client = await resolveClient(
    supabase,
    organizationId,
    optional(formData, "client_id"),
    optional(formData, "new_client"),
  );
  if ("error" in client) return { error: client.error };

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      client_id: client.id,
      description: optional(formData, "description"),
      project_type: (optional(formData, "project_type") ?? "other") as ProjectType,
      status: (optional(formData, "status") ?? "lead") as ProjectStatus,
      location: optional(formData, "location"),
      budget,
      start_date: optional(formData, "start_date"),
      end_date: optional(formData, "end_date"),
    })
    .eq("id", projectId);
  if (error) return { error: permissionMessage(error) };
  refresh();
  return { ok: true };
}

export async function setProjectStatus(projectId: string, status: ProjectStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(permissionMessage(error));
  redirect("/projects");
}

export async function createVenue(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = text(formData, "name");
  const address = optional(formData, "address");
  const lng = Number(formData.get("lng"));
  const lat = Number(formData.get("lat"));
  const zoom = Number(formData.get("zoom") ?? 16);
  if (!name) return { error: "Give the venue a name." };
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return { error: "Search for the venue or click its location on the map." };
  }

  const supabase = await createClient();
  const { data: venue, error } = await supabase
    .from("venues")
    .insert({ project_id: projectId, name, address, center_lng: lng, center_lat: lat, zoom })
    .select("id")
    .single();
  if (error) return { error: permissionMessage(error) };

  const { error: layerError } = await supabase.from("layers").insert(
    DEFAULT_LAYERS.map((l, i) => ({ ...l, sort_order: i, project_id: projectId, venue_id: venue.id })),
  );
  if (layerError) return { error: layerError.message };

  redirect(`/projects/${projectId}/venues/${venue.id}`);
}

export async function addMember(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = text(formData, "email");
  const role = (text(formData, "role") || "editor") as MemberRole;
  if (!email) return { error: "Enter the person's email." };

  const supabase = await createClient();
  const { data: userId, error } = await supabase.rpc("add_member_by_email", {
    eid: projectId,
    member_email: email,
    member_role: role,
  });
  if (error) return { error: permissionMessage(error) };

  const responsibility = text(formData, "responsibility");
  if (responsibility && userId) {
    await supabase
      .from("project_members")
      .update({ responsibility })
      .eq("project_id", projectId)
      .eq("user_id", userId);
  }
  refresh();
  return { ok: true };
}

export async function updateMember(
  projectId: string,
  userId: string,
  patch: { role?: MemberRole; responsibility?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .update(patch)
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

export async function removeMember(projectId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}
