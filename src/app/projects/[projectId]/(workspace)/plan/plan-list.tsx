"use client";

import { useActionState, useTransition } from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { PlanPhaseRow } from "@/lib/types";
import type { ActionState } from "../../../actions";
import { addPlanPhase, deletePlanPhase } from "../work-actions";

export function PlanList({
  projectId,
  phases,
  canEdit,
}: {
  projectId: string;
  phases: PlanPhaseRow[];
  canEdit: boolean;
}) {
  const [state, action, adding] = useActionState<ActionState, FormData>(addPlanPhase.bind(null, projectId), {});
  const [busy, start] = useTransition();

  return (
    <section dir="rtl" className="card p-5" data-testid="plan">
      <h2 className="font-semibold text-white">خطة إدارة المشروع</h2>
      <p className="mb-4 text-xs text-slate-500">مراحل التنفيذ من التجهيز حتى التسليم، بجدولها الزمني. مقترحة من الكراسة وقابلة للتعديل.</p>

      {phases.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">لا توجد مراحل بعد.</p>
      ) : (
        <ol className="relative mb-4 space-y-4 border-r border-slate-800 pr-5">
          {phases.map((p, i) => (
            <li key={p.id} className="relative">
              <span className="absolute -right-[26px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500 bg-slate-950 text-[9px] text-emerald-300">
                {i + 1}
              </span>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100">{p.title}</p>
                  {p.objective && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-400">{p.objective}</p>}
                  {(p.start_date || p.end_date) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <CalendarDays size={12} />
                      {[formatDate(p.start_date), formatDate(p.end_date)].filter(Boolean).join(" ← ")}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`حذف ${p.title}`}
                    disabled={busy}
                    onClick={() => confirm(`حذف مرحلة «${p.title}»؟`) && start(() => deletePlanPhase(p.id))}
                    className="text-slate-500 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {canEdit && (
        <form action={action} className="grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-2" key={phases.length}>
          <input name="title" required placeholder="اسم المرحلة" aria-label="اسم المرحلة" className="field sm:col-span-2" />
          <textarea name="objective" rows={2} placeholder="الهدف (اختياري)" aria-label="الهدف" className="field sm:col-span-2" />
          <input name="start_date" type="date" aria-label="تاريخ البداية" className="field" />
          <input name="end_date" type="date" aria-label="تاريخ النهاية" className="field" />
          <button className="btn-primary sm:col-span-2" disabled={adding}>{adding ? "جارٍ الإضافة…" : "إضافة مرحلة"}</button>
          {state.error && <p className="text-sm text-red-400 sm:col-span-2">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
