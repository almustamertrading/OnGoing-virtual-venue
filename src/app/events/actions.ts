"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean };

const DEFAULT_LAYERS = [
  { name: "Perimeter & security", color: "#ef4444" },
  { name: "Crowd flow", color: "#f59e0b" },
  { name: "Hospitality", color: "#a855f7" },
  { name: "Broadcast & media", color: "#3b82f6" },
  { name: "Logistics & power", color: "#10b981" },
];

export async function createEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const start_date = String(formData.get("start_date") ?? "") || null;
  const end_date = String(formData.get("end_date") ?? "") || null;
  if (!name) return { error: "Give the event a name." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: "You are signed out. Sign in again." };

  const { data, error } = await supabase
    .from("events")
    .insert({ name, description, start_date, end_date, created_by: userId })
    .select("id")
    .single();
  if (error) return { error: error.message };

  redirect(`/events/${data.id}`);
}

export async function deleteEvent(eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
  redirect("/events");
}

export async function createVenue(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
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
    .insert({ event_id: eventId, name, address, center_lng: lng, center_lat: lat, zoom })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: layerError } = await supabase.from("layers").insert(
    DEFAULT_LAYERS.map((l, i) => ({ ...l, sort_order: i, event_id: eventId, venue_id: venue.id })),
  );
  if (layerError) return { error: layerError.message };

  redirect(`/events/${eventId}/venues/${venue.id}`);
}

export async function deleteVenue(eventId: string, venueId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("venues").delete().eq("id", venueId);
  if (error) throw new Error(error.message);
  revalidatePath(`/events/${eventId}`);
}

export async function addMember(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "editor") as MemberRole;
  if (!email) return { error: "Enter the person's email." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_member_by_email", {
    eid: eventId,
    member_email: email,
    member_role: role,
  });
  if (error) return { error: error.message };
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function updateMemberRole(eventId: string, userId: string, role: MemberRole) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_members")
    .update({ role })
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/events/${eventId}`);
}

export async function removeMember(eventId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_members")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/events/${eventId}`);
}
