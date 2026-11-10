import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiErrorMessage } from "./ai/config";
import { runAi } from "./ai/run";
import { AiError } from "./ai/types";
import { BOQ_EXTRACT_SCHEMA, BOQ_EXTRACT_SYSTEM, boqPrompt, mockBoqOutput, parseBoqLines } from "./boq-extract";
import { loadProjectPdf } from "./doc-intel/load";
import { pagedText } from "./doc-intel/text";

const MAX_PROMPT_CHARS = 150_000;

export type BoqExtractionResult = { created: number; quantityChecked: number; pagesRead: number; truncated: boolean };

/**
 * Reads a tender PDF from Documents as the signed-in user, asks the AI for the BOQ lines, checks each quote
 * against its page and each quantity against its quote, and stores the lines as findings awaiting a person's
 * verification. Nothing enters the BOQ here.
 */
export async function extractBoqFromDocument(
  supabase: SupabaseClient,
  opts: { projectId: string; documentId: string; force?: boolean },
): Promise<BoqExtractionResult> {
  const { doc, pages } = await loadProjectPdf(supabase, opts.projectId, opts.documentId, "جدول الكميات");
  const paged = pagedText(pages, MAX_PROMPT_CHARS);

  const result = await runAi(
    supabase,
    {
      organizationId: doc.organization_id,
      feature: "boq_extract",
      hashParts: [opts.documentId, createHash("sha256").update(pages.join("\f")).digest("hex")],
      force: opts.force,
    },
    {
      feature: "boq_extract",
      system: BOQ_EXTRACT_SYSTEM,
      content: boqPrompt(paged),
      maxTokens: 12000,
      effort: "low",
      jsonSchema: BOQ_EXTRACT_SCHEMA,
      mock: () => mockBoqOutput(pages),
    },
  );

  let lines;
  try {
    lines = parseBoqLines(result.text, pages);
  } catch {
    throw new AiError("invalid_output", aiErrorMessage("invalid_output"));
  }
  if (lines.length === 0) return { created: 0, quantityChecked: 0, pagesRead: paged.includedPages, truncated: paged.truncated };

  const { error } = await supabase.from("ai_findings").insert(
    lines.map((l) => ({
      organization_id: doc.organization_id,
      project_id: opts.projectId,
      document_id: doc.id,
      workflow: "boq",
      kind: "boq_line",
      title: l.title,
      detail: l.detail,
      severity: l.severity,
      source_page: l.page,
      source_excerpt: l.excerpt,
      source_verified: l.verified,
      data: l.data,
      ai_usage_log_id: result.logId,
    })),
  );
  if (error) throw new AiError("failed", "تعذّر حفظ البنود المستخرجة. تحقّق من صلاحيتك على المشروع وحاول مجددًا.");
  return {
    created: lines.length,
    quantityChecked: lines.filter((l) => l.data.quantity_in_source && l.verified).length,
    pagesRead: paged.includedPages,
    truncated: paged.truncated,
  };
}
