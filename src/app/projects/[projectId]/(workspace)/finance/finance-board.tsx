"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import type { ExpenseRow, InvoiceRow, InvoiceStatus } from "@/lib/types";
import type { ActionState } from "../../../actions";
import { addExpense, addInvoice, deleteExpense, deleteInvoice, updateInvoice } from "./actions";

const INV_STATUS: Record<InvoiceStatus, { label: string; tone: string }> = {
  draft: { label: "مسودة", tone: "bg-slate-700 text-slate-100" },
  sent: { label: "مُرسلة", tone: "bg-sky-900 text-sky-100" },
  paid: { label: "مدفوعة", tone: "bg-emerald-900 text-emerald-100" },
};

export function FinanceBoard({
  projectId, currency, canEdit, budget, quoted, invoices, expenses,
}: {
  projectId: string;
  currency: string;
  canEdit: boolean;
  budget: number | null;
  quoted: number;
  invoices: InvoiceRow[];
  expenses: ExpenseRow[];
}) {
  const invoiced = invoices.reduce((s, i) => s + i.amount, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const basis = budget ?? quoted;
  const margin = basis - spent;
  const m = (v: number) => formatMoney(v, currency);

  const cards: { k: string; v: string; tone?: string }[] = [
    { k: "الميزانية", v: budget != null ? m(budget) : "—" },
    { k: "العرض (BOQ)", v: quoted ? m(quoted) : "—" },
    { k: "المصروفات", v: m(spent), tone: "text-amber-300" },
    { k: "المفوتر", v: m(invoiced) },
    { k: "المحصّل", v: m(paid), tone: "text-emerald-300" },
    { k: "الهامش التقديري", v: basis ? m(margin) : "—", tone: !basis ? "text-white" : margin >= 0 ? "text-emerald-300" : "text-red-300" },
  ];

  return (
    <div dir="rtl" className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.k} className="card p-3">
            <p className="text-xs text-slate-500">{c.k}</p>
            <p className={`mt-1 text-sm font-bold ${c.tone ?? "text-white"}`}>{c.v}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Invoices */}
        <section className="card p-5">
          <h2 className="font-semibold text-white">الفواتير</h2>
          <p className="mb-3 text-xs text-slate-500">فواتير العميل وحالة التحصيل.</p>
          {invoices.length === 0 ? (
            <p className="mb-3 text-sm text-slate-500">لا توجد فواتير.</p>
          ) : (
            <ul className="mb-3 divide-y divide-slate-800">
              {invoices.map((i) => (
                <InvoiceRowItem key={i.id} inv={i} currency={currency} canEdit={canEdit} />
              ))}
            </ul>
          )}
          {canEdit && <InvoiceForm projectId={projectId} resetKey={invoices.length} />}
        </section>

        {/* Expenses */}
        <section className="card p-5">
          <h2 className="font-semibold text-white">المصروفات</h2>
          <p className="mb-3 text-xs text-slate-500">التكاليف الفعلية على المشروع.</p>
          {expenses.length === 0 ? (
            <p className="mb-3 text-sm text-slate-500">لا توجد مصروفات.</p>
          ) : (
            <ul className="mb-3 divide-y divide-slate-800">
              {expenses.map((e) => (
                <ExpenseRowItem key={e.id} exp={e} currency={currency} canEdit={canEdit} />
              ))}
            </ul>
          )}
          {canEdit && <ExpenseForm projectId={projectId} resetKey={expenses.length} />}
        </section>
      </div>
    </div>
  );
}

function InvoiceRowItem({ inv, currency, canEdit }: { inv: InvoiceRow; currency: string; canEdit: boolean }) {
  const [busy, start] = useTransition();
  const st = INV_STATUS[inv.status];
  return (
    <li className="flex items-center gap-2 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-slate-100">{inv.title} {inv.number && <span className="text-xs text-slate-500">#{inv.number}</span>}</p>
        {inv.due_date && <p className="text-xs text-slate-500">الاستحقاق: {formatDate(inv.due_date)}</p>}
      </div>
      <span className="font-medium text-white">{formatMoney(inv.amount, currency)}</span>
      {canEdit ? (
        <select
          aria-label={`حالة فاتورة ${inv.title}`}
          value={inv.status}
          disabled={busy}
          onChange={(e) => start(() => updateInvoice(inv.id, { status: e.target.value as InvoiceStatus }))}
          className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
        >
          {Object.entries(INV_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
      ) : (
        <span className={`rounded-full px-2 py-0.5 text-xs ${st.tone}`}>{st.label}</span>
      )}
      {canEdit && (
        <button type="button" aria-label={`حذف ${inv.title}`} disabled={busy} onClick={() => confirm("حذف الفاتورة؟") && start(() => deleteInvoice(inv.id))} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
      )}
    </li>
  );
}

function ExpenseRowItem({ exp, currency, canEdit }: { exp: ExpenseRow; currency: string; canEdit: boolean }) {
  const [busy, start] = useTransition();
  return (
    <li className="flex items-center gap-2 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-slate-100">{exp.label}</p>
        <p className="text-xs text-slate-500">{[exp.category, exp.vendor, exp.incurred_on && formatDate(exp.incurred_on)].filter(Boolean).join(" · ")}</p>
      </div>
      <span className="font-medium text-amber-300">{formatMoney(exp.amount, currency)}</span>
      {canEdit && (
        <button type="button" aria-label={`حذف ${exp.label}`} disabled={busy} onClick={() => confirm("حذف المصروف؟") && start(() => deleteExpense(exp.id))} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
      )}
    </li>
  );
}

function InvoiceForm({ projectId, resetKey }: { projectId: string; resetKey: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addInvoice.bind(null, projectId), {});
  return (
    <form action={action} className="grid gap-2 border-t border-slate-800 pt-3 sm:grid-cols-2" key={resetKey}>
      <input name="title" required placeholder="وصف الفاتورة" aria-label="وصف الفاتورة" className="field sm:col-span-2" />
      <input name="number" placeholder="رقم الفاتورة" aria-label="رقم الفاتورة" className="field" />
      <input name="amount" inputMode="decimal" placeholder="المبلغ" aria-label="المبلغ" className="field" />
      <input name="due_date" type="date" aria-label="الاستحقاق" className="field" />
      <button className="btn-primary" disabled={pending}>{pending ? "…" : "إضافة فاتورة"}</button>
      {state.error && <p className="text-sm text-red-400 sm:col-span-2">{state.error}</p>}
    </form>
  );
}

function ExpenseForm({ projectId, resetKey }: { projectId: string; resetKey: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addExpense.bind(null, projectId), {});
  return (
    <form action={action} className="grid gap-2 border-t border-slate-800 pt-3 sm:grid-cols-2" key={resetKey}>
      <input name="label" required placeholder="وصف المصروف" aria-label="وصف المصروف" className="field sm:col-span-2" />
      <input name="category" placeholder="التصنيف" aria-label="التصنيف" className="field" />
      <input name="vendor" placeholder="المورّد/الجهة" aria-label="المورّد" className="field" />
      <input name="amount" inputMode="decimal" placeholder="المبلغ" aria-label="المبلغ" className="field" />
      <input name="incurred_on" type="date" aria-label="التاريخ" className="field" />
      <button className="btn-primary sm:col-span-2" disabled={pending}>{pending ? "…" : "إضافة مصروف"}</button>
      {state.error && <p className="text-sm text-red-400 sm:col-span-2">{state.error}</p>}
    </form>
  );
}
