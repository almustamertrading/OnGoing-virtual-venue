import "server-only";

/** Text of each page of a PDF (empty strings for pages without a text layer, e.g. scans). */
export async function readPdfPages(bytes: Uint8Array): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages.map((p) => (p ?? "").replace(/\u0000/g, "").trim());
}
