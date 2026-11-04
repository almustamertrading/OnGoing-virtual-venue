"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, ProjectStatus, ProjectType } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean };

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

/** Finds or creates a client by name inside the organisation. */
async function resolveClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  clientId: string | null,
  newClientName: string | null,
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
      .insert({ organization_id: organizationId, name: newClientName })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: data.id as string };
  }
  return { id: clientId };
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
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  redirect(`/projects/${data.id}`);
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
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function setProjectStatus(projectId: string, status: ProjectStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
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
  if (error) return { error: error.message };

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
  if (error) return { error: error.message };

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
  if (error) throw new Error(error.message);
  refresh();
}

export async function removeMember(projectId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  refresh();
}
