"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { BoqCheckPanel } from "@/components/boq-check-panel";
import { formatMoney } from "@/lib/format";
import type { BoqItemRow } from "@/lib/types";
import type { ActionState } from "../../../actions";
import { addBoqItem, deleteBoqItem, updateBoqItem } from "../work-actions";
import { boqTotal, lineTotal } from "@/lib/money";

/** Row ids, so the BOQ checker's findings link to their rows. */
const ROW_ANCHOR = "boq-item-";

const n = (v: string) => {
  const raw = v.replace(/[, ]/g, "").trim();
  if (!raw) return null;
  const x = Number(raw);
  return Number.isFinite(x) && x >= 0 ? x : null;
};

export function PricingTable({
  projectId,
  items,
  canEdit,
  currency,
}: {
  projectId: string;
  items: BoqItemRow[];
  canEdit: boolean;
  currency: string;
}) {
  const [state, action, adding] = useActionState<ActionState, FormData>(addBoqItem.bind(null, projectId), {});
  const [busy, start] = useTransition();

  const grand = boqTotal(items);
  const priced = items.filter((it) => it.unit_price != null).length;

  return (
    <section dir="rtl" className="card p-5" data-testid="pricing">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-white">نموذج التسعير — جدول الكميات</h2>
        <span className="text-xs text-slate-500">{priced}/{items.length} بند مُسعّر</span>
      </div>
      <p className="mb-4 text-xs text-slate-500">الكميات من الكراسة. أدخل سعر الوحدة ويُحسب الإجمالي تلقائيًا.</p>

      {/* The project BOQ has no internal costs, so no finance checks. */}
      <BoqCheckPanel lines={items} finance={false} anchorPrefix={ROW_ANCHOR} />

      {items.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">لا توجد بنود بعد.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th className="px-2 py-2 font-medium">البند</th>
                <th className="px-2 py-2 font-medium">الوحدة</th>
                <th className="px-2 py-2 font-medium">الكمية</th>
                <th className="px-2 py-2 font-medium">سعر الوحدة</th>
                <th className="px-2 py-2 font-medium">الإجمالي</th>
                {canEdit && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((it) => (
                <tr key={it.id} id={`${ROW_ANCHOR}${it.id}`} className="align-top">
                  <td className="px-2 py-2 text-slate-100">{it.description}</td>
                  <td className="px-2 py-2 text-slate-400">{it.unit || "—"}</td>
                  <td className="px-2 py-2 text-slate-300">
                    {canEdit ? (
                      <input
                        defaultValue={it.quantity ?? ""}
                        inputMode="decimal"
                        aria-label={`كمية ${it.description}`}
                        disabled={busy}
                        onBlur={(e) => {
                          const v = n(e.target.value);
                          if (v !== it.quantity) start(() => updateBoqItem(it.id, { quantity: v }));
                        }}
                        className="w-20 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
                      />
                    ) : (
                      (it.quantity ?? "—")
                    )}
                  </td>
                  <td className="px-2 py-2 text-slate-300">
                    {canEdit ? (
                      <input
                        defaultValue={it.unit_price ?? ""}
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`سعر وحدة ${it.description}`}
                        disabled={busy}
                        onBlur={(e) => {
                          const v = n(e.target.value);
                          if (v !== it.unit_price) start(() => updateBoqItem(it.id, { unit_price: v }));
                        }}
                        className="w-24 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
                      />
                    ) : it.unit_price != null ? (
                      formatMoney(it.unit_price, currency)
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2 font-medium text-emerald-300">
                    {lineTotal(it.quantity, it.unit_price) != null ? formatMoney(lineTotal(it.quantity, it.unit_price), currency) : "—"}
                  </td>
                  {canEdit && (
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        aria-label={`حذف ${it.description}`}
                        disabled={busy}
                        onClick={() => confirm(`حذف «${it.description}»؟`) && start(() => deleteBoqItem(it.id))}
                        className="text-slate-500 hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-700">
                <td className="px-2 py-2.5 font-semibold text-white" colSpan={4}>الإجمالي التقديري</td>
                <td className="px-2 py-2.5 font-bold text-emerald-300" colSpan={canEdit ? 2 : 1}>
                  {formatMoney(grand, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canEdit && (
        <form action={action} className="mt-4 grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-2" key={items.length}>
          <input name="description" required placeholder="وصف البند" aria-label="وصف البند" className="field sm:col-span-2" />
          <input name="unit" placeholder="الوحدة (مثال: عدد، م²)" aria-label="الوحدة" className="field" />
          <input name="quantity" inputMode="decimal" placeholder="الكمية" aria-label="الكمية" className="field" />
          <input name="unit_price" inputMode="decimal" placeholder="سعر الوحدة (اختياري)" aria-label="سعر الوحدة" className="field" />
          <button className="btn-primary" disabled={adding}>{adding ? "جارٍ الإضافة…" : "إضافة بند"}</button>
          {state.error && <p className="text-sm text-red-400 sm:col-span-2">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
