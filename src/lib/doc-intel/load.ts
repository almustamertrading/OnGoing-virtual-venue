import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiError } from "../ai/types";
import { readPdfPages } from "./pdf";

const MAX_BYTES = 25 * 1024 * 1024;

export type ProjectPdf = {
  doc: { id: string; organization_id: string; project_id: string; title: string };
  pages: string[];
};

/**
 * Reads the text of a project PDF from Documents page by page, as the signed-in user (RLS decides access).
 * Refuses files of another project, non-PDFs, files over 25 MB and scans without a text layer.
 */
export async function loadProjectPdf(supabase: SupabaseClient, projectId: string, documentId: string, purpose: string): Promise<ProjectPdf> {
  const { data: doc } = await supabase
    .from("documents")
    .select("id, organization_id, project_id, title, file_name, mime_type, size_bytes, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || doc.project_id !== projectId) throw new AiError("failed", "المستند غير موجود في هذا المشروع، أو ليست لديك صلاحية عليه.");
  const isPdf = String(doc.mime_type ?? "").includes("pdf") || String(doc.file_name).toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new AiError("failed", "التحليل متاح لملفات PDF فقط حاليًا.");
  if (Number(doc.size_bytes) > MAX_BYTES) throw new AiError("too_large", `الملف أكبر من 25 ميغابايت. قسّمه أو ارفع الجزء الخاص بـ${purpose}.`);

  const { data: blob, error } = await supabase.storage.from("documents").download(doc.storage_path as string);
  if (error || !blob) throw new AiError("failed", "تعذّر قراءة الملف من المستندات. حاول مجددًا.");
  const pages = await readPdfPages(new Uint8Array(await blob.arrayBuffer())).catch(() => [] as string[]);
  // A scan without a text layer yields (almost) no text; a short genuine BOQ page still has a few lines.
  if (pages.reduce((n, p) => n + p.replace(/\s+/g, "").length, 0) < 60) {
    throw new AiError("failed", "لا يحتوي الملف على نص قابل للقراءة (ربما ممسوح ضوئيًا). ارفع نسخة نصية من الملف.");
  }
  return {
    doc: { id: doc.id as string, organization_id: doc.organization_id as string, project_id: doc.project_id as string, title: doc.title as string },
    pages,
  };
}
