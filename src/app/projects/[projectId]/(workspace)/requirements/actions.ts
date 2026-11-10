"use server";

import { refresh } from "next/cache";
import { aiErrorMessage } from "@/lib/ai/config";
import { AiError, type AiErrorCode } from "@/lib/ai/types";
import { permissionMessage } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { REGISTER_KINDS, REQUIREMENT_CATEGORIES } from "@/lib/tender";
import { analyzeTenderDocument } from "@/lib/tender-analysis";
import type { RequirementCategory, RequirementStatus } from "@/lib/types";

export type AnalysisState = { error?: string; code?: AiErrorCode; message?: string; ok?: boolean };
export type ReviewResult = { error?: string; ok?: boolean };

function reviewMessage(error: { code?: string; message?: string }): string {
  if (/already reviewed|Reopen a reviewed/i.test(error.message ?? "")) return "تمت مراجعة هذه النتيجة من قبل. حدّث الصفحة.";
  if (error.code === "23514") return "المسؤول يجب أن يكون عضوًا في المشروع أو المنظمة.";
  if (error.code === "23503") return "المستند المختار غير متاح لهذا المشروع.";
  return permissionMessage(error) ?? "تعذّر تنفيذ الإجراء.";
}

/** Runs the AI tender analysis on one of the project's PDFs. Results arrive as findings to review. */
export async function analyzeTender(projectId: string, _prev: AnalysisState, formData: FormData): Promise<AnalysisState> {
  const documentId = String(formData.get("document_id") ?? "");
  if (!documentId) return { error: "اختر ملف كراسة الشروط أولًا." };
  const supabase = await createClient();
  try {
    const r = await analyzeTenderDocument(supabase, { projectId, documentId, force: formData.get("force") === "on" });
    refresh();
    if (r.created === 0) return { ok: true, message: "لم يُعثر على متطلبات قابلة للاستخراج في هذا الملف." };
    const pages = r.truncated ? ` (حُلّلت أول ${r.pagesRead} صفحة فقط)` : "";
    return { ok: true, message: `أُضيفت ${r.created} نتيجة للمراجعة، منها ${r.verified} بمصدر مُتحقَّق منه${pages}.` };
  } catch (e) {
    if (e instanceof AiError) return { error: e.message, code: e.code };
    console.error("analyzeTender failed:", e);
    return { error: aiErrorMessage("failed"), code: "failed" };
  }
}

/** Accepts a finding: requirement-type findings become register rows (one transaction); others are acknowledged. */
export async function acceptFinding(findingId: string, kind: string, note: string): Promise<ReviewResult> {
  const supabase = await createClient();
  if (REGISTER_KINDS.has(kind)) {
    const { error } = await supabase.rpc("accept_finding_as_requirement", { fid: findingId, note: note.slice(0, 1000) });
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

export async function rejectFinding(findingId: string, note: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_findings").update({ status: "rejected", review_note: note.slice(0, 1000) }).eq("id", findingId).select("id");
  if (error) return { error: reviewMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true };
}

export async function reopenFinding(findingId: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_findings").update({ status: "proposed" }).eq("id", findingId).select("id");
  if (error) return { error: reviewMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true };
}

export type RegisterState = { error?: string; ok?: boolean; nonce?: number };

/** Adds a requirement by hand (the register is not limited to what the AI found). */
export async function addRequirement(projectId: string, organizationId: string, _prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const title = String(formData.get("title") ?? "").trim().slice(0, 300);
  if (!title) return { error: "اكتب المتطلب." };
  const category = String(formData.get("category") ?? "other") as RequirementCategory;
  const due = String(formData.get("due_date") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.from("project_requirements").insert({
    project_id: projectId,
    organization_id: organizationId,
    title,
    category: REQUIREMENT_CATEGORIES.includes(category) ? category : "other",
    mandatory: formData.get("mandatory") === "on",
    due_date: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
  });
  if (error) return { error: reviewMessage(error) };
  refresh();
  return { ok: true, nonce: Date.now() };
}

export type RequirementPatch = {
  status?: RequirementStatus;
  owner_id?: string | null;
  due_date?: string | null;
  document_id?: string | null;
  category?: RequirementCategory;
  mandatory?: boolean;
};

export async function updateRequirement(id: string, patch: RequirementPatch): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_requirements").update(patch).eq("id", id).select("id");
  if (error) return { error: reviewMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true };
}

export async function deleteRequirement(id: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_requirements").delete().eq("id", id).select("id");
  if (error) return { error: reviewMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true };
}
