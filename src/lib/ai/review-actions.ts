"use server";

import { refresh } from "next/cache";
import { permissionMessage } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type ReviewResult = { error?: string; ok?: boolean };

/** Maps database refusals from finding reviews to Arabic messages. */
function reviewMessage(error: { code?: string; message?: string }): string {
  if (/already reviewed|Reopen a reviewed/i.test(error.message ?? "")) return "تمت مراجعة هذه النتيجة من قبل. حدّث الصفحة.";
  if (error.code === "23514") return "المسؤول يجب أن يكون عضوًا في المشروع أو المنظمة.";
  if (error.code === "23503") return "العنصر المرتبط غير متاح لهذا المشروع.";
  return permissionMessage(error) ?? "تعذّر تنفيذ الإجراء.";
}

/** Shared by every AI workflow: reject a proposed finding (the database stamps who and when). */
export async function rejectFinding(findingId: string, note: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_findings").update({ status: "rejected", review_note: note.slice(0, 1000) }).eq("id", findingId).select("id");
  if (error) return { error: reviewMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true };
}

/** Reopen a reviewed finding; the earlier decision is cleared by the database. */
export async function reopenFinding(findingId: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_findings").update({ status: "proposed" }).eq("id", findingId).select("id");
  if (error) return { error: reviewMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true };
}

/** Accept through a workflow's database function (one transaction), or acknowledge when there is none. */
export async function acceptFindingVia(rpc: string | null, findingId: string, note: string): Promise<ReviewResult> {
  const allowed = new Set(["accept_finding_as_requirement", "accept_finding_as_task", "accept_finding_as_risk", "accept_finding_as_boq_item"]);
  const supabase = await createClient();
  if (rpc) {
    if (!allowed.has(rpc)) return { error: "إجراء غير معروف." };
    const { error } = await supabase.rpc(rpc, { fid: findingId, note: note.slice(0, 1000) });
    if (error) return { error: reviewMessage(error) };
  } else {
    const { data, error } = await supabase
      .from("ai_findings").update({ status: "accepted", review_note: note.slice(0, 1000) }).eq("id", findingId).select("id");
    if (error) return { error: reviewMessage(error) };
    if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  }
  refresh();
  return { ok: true };
}
