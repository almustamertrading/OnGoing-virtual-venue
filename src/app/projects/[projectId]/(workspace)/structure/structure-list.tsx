"use client";

import { useActionState, useTransition } from "react";
import { Trash2, Users } from "lucide-react";
import type { TeamRoleRow } from "@/lib/types";
import type { ActionState } from "../../../actions";
import { addTeamRole, deleteTeamRole } from "../work-actions";

export function StructureList({
  projectId,
  roles,
  canEdit,
}: {
  projectId: string;
  roles: TeamRoleRow[];
  canEdit: boolean;
}) {
  const [state, action, adding] = useActionState<ActionState, FormData>(addTeamRole.bind(null, projectId), {});
  const [busy, start] = useTransition();
  const total = roles.reduce((s, r) => s + (r.headcount || 0), 0);

  return (
    <section dir="rtl" className="card p-5" data-testid="structure">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-100">هيكل فريق العمل</h2>
        <span className="flex items-center gap-1 text-xs text-slate-400"><Users size={13} /> {total} فرد في {roles.length} دور</span>
      </div>
      <p className="mb-4 text-xs text-slate-500">الأدوار المطلوبة لتنفيذ نطاق العمل. مقترحة من الكراسة وقابلة للتعديل.</p>

      {roles.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">لا توجد أدوار بعد.</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-800">
          {roles.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 flex h-9 min-w-9 items-center justify-center rounded-lg bg-violet-500/15 px-2 text-sm font-semibold text-violet-300">
                ×{r.headcount}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-100">{r.title}</p>
                {r.responsibility && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-400">{r.responsibility}</p>}
                {r.reports_to && <p className="mt-0.5 text-xs text-slate-500">يرفع إلى: {r.reports_to}</p>}
              </div>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`حذف ${r.title}`}
                  disabled={busy}
                  onClick={() => confirm(`حذف دور «${r.title}»؟`) && start(() => deleteTeamRole(r.id))}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form action={action} className="grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-2" key={roles.length}>
          <input name="title" required placeholder="اسم الدور (مثال: مدير المشروع)" aria-label="اسم الدور" className="field" />
          <input name="headcount" inputMode="numeric" placeholder="العدد" aria-label="العدد" className="field" />
          <textarea name="responsibility" rows={2} placeholder="المسؤولية (اختياري)" aria-label="المسؤولية" className="field sm:col-span-2" />
          <button className="btn-primary sm:col-span-2" disabled={adding}>{adding ? "جارٍ الإضافة…" : "إضافة دور"}</button>
          {state.error && <p className="text-sm text-red-400 sm:col-span-2">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
