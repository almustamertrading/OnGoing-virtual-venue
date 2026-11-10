import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiErrorMessage } from "./ai/config";
import { runAi } from "./ai/run";
import { AiError } from "./ai/types";
import { readPdfPages } from "./doc-intel/pdf";
import { pagedText } from "./doc-intel/text";
import { mockTenderOutput, parseTenderFindings, TENDER_SCHEMA, TENDER_SYSTEM, tenderPrompt } from "./tender";

const MAX_BYTES = 25 * 1024 * 1024;
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
  const { data: doc } = await supabase
    .from("documents")
    .select("id, organization_id, project_id, title, file_name, mime_type, size_bytes, storage_path")
    .eq("id", opts.documentId)
    .maybeSingle();
  if (!doc || doc.project_id !== opts.projectId) throw new AiError("failed", "المستند غير موجود في هذا المشروع، أو ليست لديك صلاحية عليه.");
  const isPdf = String(doc.mime_type ?? "").includes("pdf") || String(doc.file_name).toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new AiError("failed", "التحليل متاح لملفات PDF فقط حاليًا.");
  if (Number(doc.size_bytes) > MAX_BYTES) throw new AiError("too_large", "الملف أكبر من 25 ميغابايت. قسّمه أو ارفع الجزء الخاص بالشروط.");

  const { data: blob, error: dlError } = await supabase.storage.from("documents").download(doc.storage_path as string);
  if (dlError || !blob) throw new AiError("failed", "تعذّر قراءة الملف من المستندات. حاول مجددًا.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pages = await readPdfPages(bytes).catch(() => [] as string[]);
  const textChars = pages.reduce((n, p) => n + p.length, 0);
  if (textChars < 200) {
    throw new AiError("failed", "لا يحتوي الملف على نص قابل للقراءة (ربما ممسوح ضوئيًا). ارفع نسخة نصية من الكراسة.");
  }
  const paged = pagedText(pages, MAX_PROMPT_CHARS);

  const result = await runAi(
    supabase,
    {
      organizationId: doc.organization_id as string,
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
