"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-emerald-600 print:hidden"
    >
      <Printer size={16} /> طباعة / حفظ PDF
    </button>
  );
}
