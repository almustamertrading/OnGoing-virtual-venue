"use server";

import { refresh } from "next/cache";
import { aiErrorMessage } from "@/lib/ai/config";
import { acceptFindingVia, type ReviewResult } from "@/lib/ai/review-actions";
import { AiError, type AiErrorCode } from "@/lib/ai/types";
import { extractBoqFromDocument } from "@/lib/boq-extraction";
import { createClient } from "@/lib/supabase/server";

export type BoqExtractState = { error?: string; ok?: boolean; message?: string; code?: AiErrorCode };

/** Runs the AI BOQ extraction on a project PDF. Lines arrive as findings to verify, never straight into the BOQ. */
export async function extractBoq(projectId: string, _prev: BoqExtractState, formData: FormData): Promise<BoqExtractState> {
  const documentId = String(formData.get("document_id") ?? "");
  if (!documentId) return { error: "اختر الملف الذي يحتوي جدول الكميات أولًا." };
  const supabase = await createClient();
  try {
    const r = await extractBoqFromDocument(supabase, { projectId, documentId, force: formData.get("force") === "on" });
    refresh();
    if (r.created === 0) return { ok: true, message: "لم يُعثر على بنود كميات في هذا الملف." };
    const pages = r.truncated ? ` (قُرئت أول ${r.pagesRead} صفحة فقط)` : "";
    return { ok: true, message: `استُخرج ${r.created} بند للتحقق، منها ${r.quantityChecked} كميتها موجودة في النص المقتبس${pages}.` };
  } catch (e) {
    if (e instanceof AiError) return { error: e.message, code: e.code };
    console.error("extractBoq failed:", e);
    return { error: aiErrorMessage("failed"), code: "failed" };
  }
}

/** Accepting an extracted line is its human verification: it joins the BOQ in one transaction. */
export async function acceptBoqFinding(findingId: string, kind: string, note: string): Promise<ReviewResult> {
  return acceptFindingVia(kind === "boq_line" ? "accept_finding_as_boq_item" : null, findingId, note);
}
