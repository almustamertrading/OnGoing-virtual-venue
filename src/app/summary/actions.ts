"use server";

import { refresh } from "next/cache";
import { aiErrorMessage } from "@/lib/ai/config";
import { acceptFindingVia, type ReviewResult } from "@/lib/ai/review-actions";
import { AiError, type AiErrorCode } from "@/lib/ai/types";
import { generateManagementBrief } from "@/lib/management-brief";
import { getMyOrganization } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";

export type BriefState = { error?: string; ok?: boolean; message?: string; code?: AiErrorCode };

/** Asks the AI for recommendations from the signed-in user's current facts. The database decides who may. */
export async function requestBrief(_prev: BriefState, formData: FormData): Promise<BriefState> {
  const org = await getMyOrganization();
  if (!org) return { error: "التوصيات متاحة لأعضاء المنظمة فقط." };
  if (!(org.access.isAdmin || org.role === "manager" || org.access.projectManager)) {
    return { error: "طلب التوصيات متاح لمديري المنظمة ومديري المشاريع." };
  }
  const supabase = await createClient();
  try {
    const r = await generateManagementBrief(supabase, { organizationId: org.id, currency: org.currency ?? "SAR", force: formData.get("force") === "on" });
    refresh();
    if (r.created === 0) return { ok: true, message: "لا توصيات: لا تنبيهات في بياناتك هذا الأسبوع." };
    return { ok: true, message: `أُضيفت ${r.created} توصية للمراجعة، منها ${r.verified} أرقامها مطابقة لبيانات النظام.` };
  } catch (e) {
    if (e instanceof AiError) return { error: e.message, code: e.code };
    console.error("requestBrief failed:", e);
    return { error: aiErrorMessage("failed"), code: "failed" };
  }
}

/** A recommendation has nothing to create: accepting records the decision. */
export async function acceptBrief(findingId: string, _kind: string, note: string): Promise<ReviewResult> {
  return acceptFindingVia(null, findingId, note);
}
