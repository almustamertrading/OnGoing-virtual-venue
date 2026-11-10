import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiErrorMessage } from "./ai/config";
import { runAi } from "./ai/run";
import { AiError } from "./ai/types";
import { loadProjectPdf } from "./doc-intel/load";
import { pagedText } from "./doc-intel/text";
import { mockTenderOutput, parseTenderFindings, TENDER_SCHEMA, TENDER_SYSTEM, tenderPrompt } from "./tender";

const MAX_PROMPT_CHARS = 150_000;

export type TenderAnalysisResult = { created: number; verified: number; pagesRead: number; truncated: boolean };

/**
 * Reads a tender PDF from Documents (as the signed-in user, so RLS decides access), asks the AI for
 * requirements, deadlines, mandatory documents, conflicts and clarification questions, checks every quoted
 * excerpt against the page text, and stores the results as findings awaiting review.
 */
export async function analyzeTenderDocument(
  supabase: SupabaseClient,
  opts: { projectId: string; documentId: string; force?: boolean },
): Promise<TenderAnalysisResult> {
  const { doc, pages } = await loadProjectPdf(supabase, opts.projectId, opts.documentId, "الشروط");
  const paged = pagedText(pages, MAX_PROMPT_CHARS);

  const result = await runAi(
    supabase,
    {
      organizationId: doc.organization_id,
      feature: "tender_analysis",
      // The same document content analysed twice within minutes is a repeat.
      hashParts: [opts.documentId, createHash("sha256").update(pages.join("\f")).digest("hex")],
      force: opts.force,
    },
    {
      feature: "tender_analysis",
      system: TENDER_SYSTEM,
      content: tenderPrompt(paged),
      maxTokens: 8000,
      effort: "medium",
      jsonSchema: TENDER_SCHEMA,
      mock: () => mockTenderOutput(pages),
    },
  );

  let findings;
  try {
    findings = parseTenderFindings(result.text, pages);
  } catch {
    throw new AiError("invalid_output", aiErrorMessage("invalid_output"));
  }
  if (findings.length === 0) return { created: 0, verified: 0, pagesRead: paged.includedPages, truncated: paged.truncated };

  const rows = findings.map((f) => ({
    organization_id: doc.organization_id,
    project_id: opts.projectId,
    document_id: doc.id,
    workflow: "tender",
    kind: f.kind,
    title: f.title,
    detail: f.detail,
    severity: f.severity,
    source_page: f.page,
    source_excerpt: f.excerpt,
    source_verified: f.verified,
    data: f.data,
    ai_usage_log_id: result.logId,
  }));
  const { error } = await supabase.from("ai_findings").insert(rows);
  if (error) throw new AiError("failed", "تعذّر حفظ النتائج. تحقّق من صلاحيتك على المشروع وحاول مجددًا.");
  return {
    created: rows.length,
    verified: findings.filter((f) => f.verified).length,
    pagesRead: paged.includedPages,
    truncated: paged.truncated,
  };
}
