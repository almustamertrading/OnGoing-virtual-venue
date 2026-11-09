"use server";

import { refresh } from "next/cache";
import {
  isUuid,
  overlappingEvents,
  parseEventForm,
  resolveTimeZone,
  type EventFormFields,
  type EventInput,
} from "@/lib/calendar";
import { permissionMessage } from "@/lib/permissions";
import { getMyOrganization } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";

export type OverlapNote = { id: string; title: string; startsAt: string; endsAt: string };
export type EventActionState = { error?: string; ok?: boolean; title?: string; overlaps?: OverlapNote[] };

type Supabase = Awaited<ReturnType<typeof createClient>>;

const FIELDS = ["title", "kind", "project_id", "all_day", "start", "end", "location", "description"] as const;

function readFields(formData: FormData): EventFormFields {
  const fields: EventFormFields = {};
  for (const key of FIELDS) {
    const value = formData.get(key);
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

function writeError(error: { code?: string; message?: string }) {
  if (error.code === "23503") return "المشروع المختار ليس من مشاريع منظمتك.";
  if (error.code === "23514") return "بيانات الحدث غير صالحة. راجع العنوان والوقت.";
  return permissionMessage(error) ?? "تعذّر حفظ الحدث.";
}

/**
 * Creates a custom event (no id) or updates one (id). The times are read in the organisation's
 * time zone, looked up here rather than trusted from the browser. RLS decides who may write:
 * contributors for organisation-wide events, project editors for project events.
 */
export async function saveCalendarEvent(_prev: EventActionState, formData: FormData): Promise<EventActionState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { error: "انتهت الجلسة. سجّل الدخول من جديد." };
  const org = await getMyOrganization();
  if (!org) return { error: "حسابك ليس ضمن منظمة، لذلك لا يمكنك إضافة أحداث." };

  const id = String(formData.get("id") ?? "").trim();
  if (id && !isUuid(id)) return { error: "لم يُعثر على الحدث." };

  const { data: orgRow } = await supabase.from("organizations").select("timezone").eq("id", org.id).maybeSingle();
  const parsed = parseEventForm(readFields(formData), resolveTimeZone(orgRow?.timezone));
  if (!parsed.ok) return { error: parsed.error };
  const input = parsed.value;
  const row = {
    title: input.title,
    kind: input.kind,
    project_id: input.projectId,
    all_day: input.allDay,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    location: input.location,
    description: input.description,
  };

  let savedId = id;
  if (id) {
    const { data, error } = await supabase
      .from("calendar_events").update(row).eq("id", id).eq("organization_id", org.id).select("id");
    if (error) return { error: writeError(error) };
    // RLS hides rows the user may not change, so "nothing updated" means "not allowed".
    if (!data?.length) return { error: "ليست لديك صلاحية لتعديل هذا الحدث." };
  } else {
    const { data, error } = await supabase
      .from("calendar_events").insert({ ...row, organization_id: org.id, created_by: userId }).select("id").single();
    if (error) return { error: writeError(error) };
    savedId = data.id as string;
  }

  const overlaps = input.allDay ? [] : await savedOverlaps(supabase, org.id, savedId, input);
  refresh();
  return { ok: true, title: input.title, overlaps };
}

/**
 * Timed events in the same scope (the same project, or organisation-wide) that overlap the
 * saved one, including any outside the range the page had loaded. A warning, never a block.
 */
async function savedOverlaps(supabase: Supabase, orgId: string, id: string, input: EventInput): Promise<OverlapNote[]> {
  let query = supabase
    .from("calendar_events")
    .select("id, title, project_id, starts_at, ends_at")
    .eq("organization_id", orgId)
    .eq("all_day", false)
    .neq("id", id)
    .lte("starts_at", input.endsAt)
    .gte("ends_at", input.startsAt)
    .order("starts_at")
    .limit(20);
  query = input.projectId ? query.eq("project_id", input.projectId) : query.is("project_id", null);
  const { data } = await query;
  const rows = (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    projectId: (r.project_id as string | null) ?? null,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
  }));
  return overlappingEvents({ id, projectId: input.projectId, startsAt: input.startsAt, endsAt: input.endsAt }, rows)
    .slice(0, 5)
    .map(({ id: rowId, title, startsAt, endsAt }) => ({ id: rowId, title, startsAt, endsAt }));
}

export async function deleteCalendarEvent(id: string): Promise<EventActionState> {
  if (!isUuid(id)) return { error: "لم يُعثر على الحدث." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_events").delete().eq("id", id).select("id");
  if (error) return { error: permissionMessage(error) };
  if (!data?.length) return { error: "ليست لديك صلاحية لحذف هذا الحدث." };
  refresh();
  return { ok: true };
}
