import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiErrorMessage } from "./ai/config";
import { runAi } from "./ai/run";
import { AiError } from "./ai/types";
import { mockOpsOutput, OPS_SCHEMA, OPS_SYSTEM, opsPrompt, parseOpsFindings, type Member } from "./ops";
import type { OpsReportRow } from "./types";

/**
 * Reads an operations report (as the signed-in user, so RLS decides access), asks the AI for action items,
 * issues, risks and decisions, checks each quoted excerpt against the report text, suggests assignees among
 * the project's members, and stores the results as findings awaiting review.
 */
export async function extractOpsFindings(
  supabase: SupabaseClient,
  opts: { projectId: string; reportId: string; members: Member[]; force?: boolean },
): Promise<{ created: number; verified: number }> {
  const { data } = await supabase.from("ops_reports").select("*").eq("id", opts.reportId).maybeSingle();
  const report = data as OpsReportRow | null;
  if (!report || report.project_id !== opts.projectId) throw new AiError("failed", "التقرير غير موجود في هذا المشروع.");
  if (report.body.trim().length < 40) throw new AiError("failed", "نص التقرير قصير جدًا. اكتب ملاحظات الزيارة أو الاجتماع أولًا.");

  const result = await runAi(
    supabase,
    {
      organizationId: report.organization_id,
      feature: "ops_extract",
      hashParts: [report.id, createHash("sha256").update(report.body).digest("hex")],
      force: opts.force,
    },
    {
      feature: "ops_extract",
      system: OPS_SYSTEM,
      content: opsPrompt(report),
      maxTokens: 4000,
      effort: "low",
      jsonSchema: OPS_SCHEMA,
      mock: () => mockOpsOutput(report.body),
    },
  );

  let findings;
  try {
    findings = parseOpsFindings(result.text, report.body, opts.members);
  } catch {
    throw new AiError("invalid_output", aiErrorMessage("invalid_output"));
  }
  if (findings.length === 0) return { created: 0, verified: 0 };
  const { error } = await supabase.from("ai_findings").insert(
    findings.map((f) => ({
      organization_id: report.organization_id,
      project_id: report.project_id,
      workflow: "operations",
      kind: f.kind,
      title: f.title,
      detail: f.detail,
      severity: f.severity,
      source_excerpt: f.excerpt,
      source_verified: f.verified,
      data: { ...f.data, report_id: report.id },
      ai_usage_log_id: result.logId,
    })),
  );
  if (error) throw new AiError("failed", "تعذّر حفظ النتائج. تحقّق من صلاحيتك على المشروع وحاول مجددًا.");
  return { created: findings.length, verified: findings.filter((f) => f.verified).length };
}
