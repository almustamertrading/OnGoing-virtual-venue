"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import type { AiStatus } from "@/lib/ai/status";
import { requestBrief, type BriefState } from "./actions";

/** Requests AI recommendations from the facts on this page. Shown to managers only. */
export function BriefPanel({ status }: { status: AiStatus }) {
  const [state, action, pending] = useActionState<BriefState, FormData>(requestBrief, {});
  const configured = status.provider !== null;
  const exhausted = status.usedThisHour >= status.perHour || status.usedToday >= status.perDay;
  return (
    <section className="card border-violet-900/40 bg-violet-950/10 p-5" aria-labelledby="brief-title" data-testid="management-brief">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Sparkles size={16} className="text-violet-300" aria-hidden />
        <h2 id="brief-title" className="text-sm font-semibold text-violet-200">توصيات الذكاء الاصطناعي</h2>
        {status.provider === "mock" && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-300">وضع تجريبي: نتائج اختبار</span>}
        {configured && <span className="ms-auto text-[11px] text-slate-400">طلباتك: {status.usedThisHour}/{status.perHour} هذه الساعة</span>}
      </div>
      <p className="mb-3 text-xs text-slate-400">
        يقترح إجراءات من الحقائق أعلاه فقط، ويذكر مع كل توصية الحقائق التي استند إليها. نتحقق آليًا من أن كل رقم في
        التوصية موجود في تلك الحقائق. التوصيات خاصة بك ويطّلع عليها مدير المنظمة، ولا يتغير شيء قبل قرارك.
      </p>
      {!configured ? (
        <p role="status" className="text-sm text-slate-400">الذكاء الاصطناعي غير مفعّل على هذا الخادم.</p>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-2">
          {state.code === "duplicate" && (
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" name="force" className="accent-violet-500" /> طلب توصيات جديدة رغم تطابق الأرقام</label>
          )}
          <button className="btn-primary" disabled={pending || exhausted}>{pending ? "جارٍ التحليل…" : "اقتراح توصيات من هذه البيانات"}</button>
          <div className="w-full" aria-live="polite">
            {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
            {state.ok && state.message && <p role="status" className="text-sm text-emerald-400">{state.message}</p>}
          </div>
        </form>
      )}
    </section>
  );
}
