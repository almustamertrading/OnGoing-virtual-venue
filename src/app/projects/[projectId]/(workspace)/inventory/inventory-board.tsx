"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { InventoryItemRow } from "@/lib/types";
import type { ActionState } from "../../../actions";
import { addInventoryItem, deleteInventoryItem, updateInventoryItem } from "./actions";

const n = (v: string) => {
  const raw = v.replace(/[, ]/g, "").trim();
  if (!raw) return null;
  const x = Number(raw);
  return Number.isFinite(x) && x >= 0 ? x : null;
};

export function InventoryBoard({
  organizationId, currency, canManage, items,
}: {
  organizationId: string;
  currency: string;
  canManage: boolean;
  items: InventoryItemRow[];
}) {
  const [busy, start] = useTransition();
  const totalValue = items.reduce((s, it) => s + it.quantity * (it.unit_rate ?? 0), 0);

  return (
    <section dir="rtl" className="card p-5" data-testid="inventory">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-white">المخزون والمعدّات</h2>
        <span className="text-xs text-slate-400">القيمة الإجمالية: <span className="font-bold text-emerald-300">{formatMoney(totalValue, currency)}</span></span>
      </div>
      <p className="mb-4 text-xs text-slate-500">سجلّ معدّات ومخزون الشركة (مشترك بين كل المشاريع).</p>

      {items.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">لا توجد أصناف بعد.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[620px] text-right text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th className="px-2 py-2 font-medium">الصنف</th>
                <th className="px-2 py-2 font-medium">التصنيف</th>
                <th className="px-2 py-2 font-medium">الوحدة</th>
                <th className="px-2 py-2 font-medium">الكمية</th>
                <th className="px-2 py-2 font-medium">سعر الوحدة</th>
                <th className="px-2 py-2 font-medium">القيمة</th>
                {canManage && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((it) => (
                <tr key={it.id} className={it.quantity <= 0 ? "text-slate-500" : "text-slate-200"}>
                  <td className="px-2 py-2">
                    {it.name}
                    {it.quantity <= 0 && <span className="ms-1 rounded bg-red-500/15 px-1 text-[10px] text-red-300">نفد</span>}
                  </td>
                  <td className="px-2 py-2 text-slate-400">{it.category || "—"}</td>
                  <td className="px-2 py-2 text-slate-400">{it.unit || "—"}</td>
                  <td className="px-2 py-2">
                    {canManage ? (
                      <input defaultValue={it.quantity} inputMode="decimal" aria-label={`كمية ${it.name}`} disabled={busy}
                        onBlur={(e) => { const v = n(e.target.value); if (v !== null && v !== it.quantity) start(() => updateInventoryItem(it.id, { quantity: v })); }}
                        className="w-20 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs" />
                    ) : it.quantity}
                  </td>
                  <td className="px-2 py-2">
                    {canManage ? (
                      <input defaultValue={it.unit_rate ?? ""} inputMode="decimal" placeholder="0" aria-label={`سعر ${it.name}`} disabled={busy}
                        onBlur={(e) => { const v = n(e.target.value); if (v !== it.unit_rate) start(() => updateInventoryItem(it.id, { unit_rate: v })); }}
                        className="w-24 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs" />
                    ) : it.unit_rate != null ? formatMoney(it.unit_rate, currency) : "—"}
                  </td>
                  <td className="px-2 py-2 font-medium text-emerald-300">{formatMoney(it.quantity * (it.unit_rate ?? 0), currency)}</td>
                  {canManage && (
                    <td className="px-2 py-2">
                      <button type="button" aria-label={`حذف ${it.name}`} disabled={busy} onClick={() => confirm(`حذف «${it.name}»؟`) && start(() => deleteInventoryItem(it.id))} className="text-slate-500 hover:text-red-400"><Trash2 size={15} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && <InventoryForm organizationId={organizationId} resetKey={items.length} />}
    </section>
  );
}

function InventoryForm({ organizationId, resetKey }: { organizationId: string; resetKey: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addInventoryItem.bind(null, organizationId), {});
  return (
    <form action={action} className="mt-4 grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-[1fr_1fr_auto_auto_auto]" key={resetKey}>
      <input name="name" required placeholder="اسم الصنف" aria-label="اسم الصنف" className="field sm:col-span-2" />
      <input name="category" placeholder="التصنيف" aria-label="التصنيف" className="field" />
      <input name="unit" placeholder="الوحدة" aria-label="الوحدة" className="field" />
      <input name="quantity" inputMode="decimal" placeholder="الكمية" aria-label="الكمية" className="field" />
      <input name="unit_rate" inputMode="decimal" placeholder="سعر الوحدة" aria-label="سعر الوحدة" className="field" />
      <button className="btn-primary" disabled={pending}>{pending ? "…" : "إضافة صنف"}</button>
      {state.error && <p className="text-sm text-red-400 sm:col-span-5">{state.error}</p>}
    </form>
  );
}
