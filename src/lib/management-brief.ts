import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiErrorMessage } from "./ai/config";
import { runAi } from "./ai/run";
import { AiError } from "./ai/types";
import {
  buildFacts, MANAGEMENT_SCHEMA, MANAGEMENT_SYSTEM, managementPrompt, mockManagementOutput, normalizeSummary, parseManagementBrief,
  type ManagementSummary,
} from "./management";

/** The summary as the signed-in user sees it (the database function runs under their access). */
export async function loadManagementSummary(supabase: SupabaseClient, organizationId: string): Promise<ManagementSummary | null> {
  const { data, error } = await supabase.rpc("management_summary", { org: organizationId });
  if (error) {
    console.error("management_summary failed:", error.message);
    return null;
  }
  return normalizeSummary(data);
}

/**
 * Asks the AI for this week's recommendations. The facts are recomputed here from the database as the
 * signed-in user, never taken from the browser. Each recommendation is checked against the facts it cites
 * and stored as a management finding (readable by its author and organisation admins only).
 */
export async function generateManagementBrief(
  supabase: SupabaseClient,
  opts: { organizationId: string; currency: string; force?: boolean },
): Promise<{ created: number; verified: number }> {
  const summary = await loadManagementSummary(supabase, opts.organizationId);
  if (!summary) throw new AiError("failed", "تعذّر حساب الملخص من بيانات النظام. حاول مجددًا.");
  const facts = buildFacts(summary, opts.currency);
  const financeIncluded = facts.some((f) => f.finance);

  const result = await runAi(
    supabase,
    {
      organizationId: opts.organizationId,
      feature: "management_brief",
      // The same figures within the duplicate window are not sent twice unless asked.
      hashParts: [opts.organizationId, createHash("sha256").update(JSON.stringify(facts.map((f) => [f.id, f.value]))).digest("hex")],
      force: opts.force,
    },
    {
      feature: "management_brief",
      system: MANAGEMENT_SYSTEM,
      content: managementPrompt(facts, summary.today),
      maxTokens: 2500,
      effort: "low",
      jsonSchema: MANAGEMENT_SCHEMA,
      mock: () => mockManagementOutput(facts),
    },
  );

  let recommendations;
  try {
    recommendations = parseManagementBrief(result.text, facts);
  } catch {
    throw new AiError("invalid_output", aiErrorMessage("invalid_output"));
  }
  if (recommendations.length === 0) return { created: 0, verified: 0 };
  const { error } = await supabase.from("ai_findings").insert(
    recommendations.map((r) => ({
      organization_id: opts.organizationId,
      project_id: null,
      workflow: "management",
      kind: "recommendation",
      title: r.title,
      detail: r.detail,
      severity: r.severity,
      source_excerpt: r.excerpt,
      source_verified: r.verified,
      // Built from finance figures: readable only with finance access, on top of author/admin only.
      finance_only: financeIncluded,
      data: { ...r.data, snapshot_at: summary.generatedAt },
      ai_usage_log_id: result.logId,
    })),
  );
  if (error) throw new AiError("failed", "تعذّر حفظ التوصيات. تحقّق من صلاحيتك وحاول مجددًا.");
  return { created: recommendations.length, verified: recommendations.filter((r) => r.verified).length };
}
