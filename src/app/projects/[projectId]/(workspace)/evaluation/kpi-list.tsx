"use client";

import { useActionState, useTransition } from "react";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import type { EvaluationCriterionRow } from "@/lib/types";
import type { ActionState } from "../../../actions";
import { addCriterion, deleteCriterion, updateCriterion } from "../work-actions";

export function KpiList({
  projectId,
  criteria,
  canEdit,
}: {
  projectId: string;
  criteria: EvaluationCriterionRow[];
  canEdit: boolean;
}) {
  const [state, action, adding] = useActionState<ActionState, FormData>(addCriterion.bind(null, projectId), {});
  const [busy, start] = useTransition();

  const met = criteria.filter((c) => c.met).length;
  const totalWeight = criteria.reduce((s, c) => s + (c.weight ?? 0), 0);
  const metWeight = criteria.reduce((s, c) => s + (c.met ? c.weight ?? 0 : 0), 0);
  const pct = criteria.length ? Math.round((met / criteria.length) * 100) : 0;

  return (
    <section dir="rtl" className="card p-5" data-testid="evaluation">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-100">معايير التقييم (KPIs)</h2>
        <span className="text-xs text-slate-400">
          {met}/{criteria.length} محقّق
          {totalWeight > 0 && <> · {Math.round(metWeight)}٪ من {Math.round(totalWeight)}٪ وزنًا</>}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">معايير ترسية العرض. التحقق من كل معيار إلزامي قبل التسليم.</p>

      {criteria.length > 0 && (
        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {criteria.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">لا توجد معايير بعد.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {criteria.map((c) => (
            <li key={c.id} className={`rounded-lg border p-3 ${c.met ? "border-emerald-900/60 bg-emerald-950/20" : "border-slate-800 bg-slate-950"}`}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-label={c.met ? `إلغاء تحقق ${c.criterion}` : `تحقّق ${c.criterion}`}
                  disabled={!canEdit || busy}
                  onClick={() => start(() => updateCriterion(c.id, { met: !c.met }))}
                  className={`mt-0.5 shrink-0 ${c.met ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"} disabled:opacity-60`}
                >
                  {c.met ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${c.met ? "text-slate-200" : "text-slate-100"}`}>{c.criterion}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.weight != null && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">{c.weight}٪</span>}
                      {canEdit && (
                        <button
                          type="button"
                          aria-label={`حذف ${c.criterion}`}
                          disabled={busy}
                          onClick={() => confirm(`حذف معيار «${c.criterion}»؟`) && start(() => deleteCriterion(c.id))}
                          className="text-slate-500 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {canEdit ? (
                    <input
                      defaultValue={c.evidence}
                      placeholder="دليل التحقق / ملاحظة…"
                      aria-label={`دليل ${c.criterion}`}
                      disabled={busy}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== c.evidence) start(() => updateCriterion(c.id, { evidence: v }));
                      }}
                      className="mt-2 w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                    />
                  ) : (
                    c.evidence && <p className="mt-1 text-xs text-slate-400">دليل: {c.evidence}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form action={action} className="grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-[1fr_auto_auto]" key={criteria.length}>
          <input name="criterion" required placeholder="معيار التقييم" aria-label="معيار التقييم" className="field" />
          <input name="weight" inputMode="decimal" placeholder="الوزن ٪" aria-label="الوزن" className="field w-24" />
          <button className="btn-primary" disabled={adding}>{adding ? "…" : "إضافة"}</button>
          {state.error && <p className="text-sm text-red-400 sm:col-span-3">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
