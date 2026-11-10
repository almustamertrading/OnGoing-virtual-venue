"use server";

import { refresh } from "next/cache";
import { aiErrorMessage } from "@/lib/ai/config";
import { acceptFindingVia, type ReviewResult } from "@/lib/ai/review-actions";
import { AiError, type AiErrorCode } from "@/lib/ai/types";
import { buildFacts, snapshotFacts, weekStart } from "@/lib/management";
import { generateManagementBrief, loadManagementSummary } from "@/lib/management-brief";
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

/**
 * Records this week's snapshot of the signed-in user's figures (once per week; finance figures are never
 * stored). The figures are recomputed here from the database, never taken from the browser.
 */
export async function recordSnapshot(): Promise<{ ok?: boolean }> {
  const org = await getMyOrganization();
  if (!org) return {};
  const supabase = await createClient();
  const summary = await loadManagementSummary(supabase, org.id);
  if (!summary) return {};
  const { error } = await supabase.from("management_snapshots").insert({
    organization_id: org.id,
    week_start: weekStart(summary.today),
    facts: snapshotFacts(buildFacts(summary, org.currency ?? "SAR")),
  });
  // Already recorded this week (e.g. two tabs open at once): nothing to do.
  if (error && error.code !== "23505") console.error("recordSnapshot failed:", error.message);
  return { ok: !error || error.code === "23505" };
}
