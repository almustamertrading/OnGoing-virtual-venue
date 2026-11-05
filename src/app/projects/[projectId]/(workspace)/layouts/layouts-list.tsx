"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { LayoutDashboard, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { LayoutRow, VenueRow } from "@/lib/types";
import type { ActionState } from "../../../actions";
import { createLayout, deleteLayout } from "./actions";

export function LayoutsList({
  projectId,
  layouts,
  venues,
  canEdit,
}: {
  projectId: string;
  layouts: LayoutRow[];
  venues: VenueRow[];
  canEdit: boolean;
}) {
  const [state, action, adding] = useActionState<ActionState, FormData>(createLayout.bind(null, projectId), {});
  const [busy, start] = useTransition();
  const venueName = (id: string | null) => venues.find((v) => v.id === id)?.name;

  return (
    <div dir="rtl" className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <h2 className="mb-1 font-semibold text-white">مخططات القاعات (Layout)</h2>
        <p className="mb-4 text-xs text-slate-500">
          وزّع الطاولات والمسرح والـAVL ومخارج الطوارئ على مخطط القاعة الداخلي. ارفع صورة المخطط وابدأ التوزيع.
        </p>
        {layouts.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد مخططات بعد.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {layouts.map((l) => (
              <li key={l.id} className="card p-0">
                <Link
                  href={`/projects/${projectId}/layouts/${l.id}`}
                  className="flex items-center gap-3 p-4 transition hover:bg-white/[0.03]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <LayoutDashboard size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-100">{l.name}</span>
                    <span className="block text-xs text-slate-500">
                      {venueName(l.venue_id) ? `${venueName(l.venue_id)} · ` : ""}
                      {formatDate(l.created_at)}
                    </span>
                  </span>
                </Link>
                {canEdit && (
                  <div className="border-t border-slate-800 px-4 py-2 text-left">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => confirm(`حذف المخطط «${l.name}»؟`) && start(() => deleteLayout(projectId, l.id))}
                      className="text-xs text-slate-500 hover:text-red-400"
                    >
                      <Trash2 size={13} className="ml-1 inline" /> حذف
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <section className="card h-fit p-5">
          <h3 className="mb-3 font-semibold text-white">مخطط جديد</h3>
          <form action={action} className="space-y-3" key={layouts.length}>
            <div>
              <label className="label" htmlFor="l-name">اسم المخطط</label>
              <input id="l-name" name="name" required placeholder="مثال: القاعة الرئيسية" className="field" />
            </div>
            {venues.length > 0 && (
              <div>
                <label className="label" htmlFor="l-venue">الموقع (اختياري)</label>
                <select id="l-venue" name="venue_id" className="field" defaultValue="">
                  <option value="">بدون ربط</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button className="btn-primary w-full" disabled={adding}>{adding ? "جارٍ الإنشاء…" : "إنشاء وفتح المحرر"}</button>
            {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          </form>
        </section>
      )}
    </div>
  );
}
