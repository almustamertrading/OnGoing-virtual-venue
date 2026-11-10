"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FileSpreadsheet } from "lucide-react";
import type { AiStatus } from "@/lib/ai/status";
import { extractBoq, type BoqExtractState } from "./actions";

/** Extracts BOQ lines from a project PDF with AI. Each line waits for a person to verify it. */
export function BoqExtractPanel({
  projectId, documents, status,
}: {
  projectId: string;
  documents: { id: string; title: string; category: string }[];
  status: AiStatus;
}) {
  const [state, action, pending] = useActionState<BoqExtractState, FormData>(extractBoq.bind(null, projectId), {});
  const configured = status.provider !== null;
  const exhausted = status.usedThisHour >= status.perHour || status.usedToday >= status.perDay;
  const sorted = [...documents].sort((a, b) => Number(b.category === "rfp") - Number(a.category === "rfp"));

  return (
    <section className="card border-violet-900/40 bg-violet-950/10 p-5" aria-labelledby="boq-ai-title" data-testid="boq-extract">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <FileSpreadsheet size={16} className="text-violet-300" aria-hidden />
        <h2 id="boq-ai-title" className="text-sm font-semibold text-violet-200">استخراج جدول الكميات من ملف بالذكاء الاصطناعي</h2>
        {status.provider === "mock" && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-300">وضع تجريبي: نتائج اختبار</span>}
        {configured && <span className="ms-auto text-[11px] text-slate-400">طلباتك: {status.usedThisHour}/{status.perHour} هذه الساعة</span>}
      </div>
      <p className="mb-3 text-xs text-slate-400">
        يقرأ الملف صفحةً صفحة وينسخ البنود والوحدات والكميات كما وردت، مع الصفحة والنص المقتبس، ويتحقق آليًا من وجود
        الكمية في النص. لا يُضاف بند إلى الجدول قبل أن تتحقق منه وتعتمده، ولا تُستخرج أي أسعار.
      </p>
      {!configured ? (
        <p role="status" className="text-sm text-slate-400">الذكاء الاصطناعي غير مفعّل على هذا الخادم. أضف البنود يدويًا.</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-slate-400">
          لا توجد ملفات PDF في مستندات المشروع. <Link href={`/projects/${projectId}/documents`} className="text-emerald-400 hover:underline">ارفع الكراسة أو جدول الكميات</Link> ثم عُد إلى هنا.
        </p>
      ) : (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="boq-doc" className="mb-1 block text-xs text-slate-400">الملف</label>
            <select id="boq-doc" name="document_id" className="field" defaultValue={sorted[0]?.id}>
              {sorted.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
          {state.code === "duplicate" && (
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" name="force" className="accent-violet-500" /> إعادة الاستخراج رغم التطابق</label>
          )}
          <button className="btn-primary" disabled={pending || exhausted}>{pending ? "جارٍ الاستخراج… قد يستغرق دقيقة" : "استخراج البنود"}</button>
          <div className="w-full" aria-live="polite">
            {exhausted && !state.error && <p className="text-sm text-amber-400">بلغت الحد المسموح من الطلبات حاليًا. حاول لاحقًا.</p>}
            {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
            {state.ok && state.message && <p role="status" className="text-sm text-emerald-400">{state.message}</p>}
          </div>
        </form>
      )}
    </section>
  );
}
