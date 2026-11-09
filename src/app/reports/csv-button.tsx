"use client";

import { Download } from "lucide-react";
import { todayIso } from "@/lib/format";
import { buildCsv, csvFileName, type CsvCell } from "@/lib/reports";

/**
 * Downloads one report table as CSV. The file is built here in the browser from the rows the
 * page already shows the viewer, so it never contains more than they can see.
 */
export function CsvButton({ section, label, header, rows }: {
  /** English slug used in the file name, e.g. "pipeline". */
  section: string;
  /** Arabic name of the table, for the accessible name. */
  label: string;
  header: string[];
  rows: CsvCell[][];
}) {
  function download() {
    const blob = new Blob([buildCsv(header, rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFileName(section, todayIso());
    document.body.append(link);
    link.click();
    link.remove();
    // Some browsers read the blob after the click returns; release it a little later.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="btn-ghost shrink-0 py-1.5 text-xs"
      aria-label={`تصدير ${label} بصيغة CSV`}
      data-testid={`csv-${section}`}
    >
      <Download size={14} aria-hidden /> تصدير CSV
    </button>
  );
}
