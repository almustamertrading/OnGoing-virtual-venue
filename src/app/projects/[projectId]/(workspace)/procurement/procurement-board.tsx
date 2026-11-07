"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, ChevronDown, Star, Trash2 } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import type { QuoteRow, RfqRow, RfqStatus, SupplierRow } from "@/lib/types";
import type { ActionState } from "../../../actions";
import {
  acceptQuote, addQuote, addRfq, addSupplier,
  deleteQuote, deleteRfq, deleteSupplier, updateRfq,
} from "./actions";

const RFQ_STATUS: Record<RfqStatus, { label: string; tone: string }> = {
  draft: { label: "مسودة", tone: "bg-slate-700 text-slate-100" },
  sent: { label: "مُرسل", tone: "bg-sky-900 text-sky-100" },
  awarded: { label: "تمت الترسية", tone: "bg-emerald-900 text-emerald-100" },
  closed: { label: "مغلق", tone: "bg-slate-800 text-slate-300" },
};

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={12} className={i < n ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
      ))}
    </span>
  );
}

export function ProcurementBoard({
  projectId, organizationId, currency, canEdit, suppliers, rfqs, quotes,
}: {
  projectId: string;
  organizationId: string;
  currency: string;
  canEdit: boolean;
  suppliers: SupplierRow[];
  rfqs: RfqRow[];
  quotes: QuoteRow[];
}) {
  const [showSuppliers, setShowSuppliers] = useState(false);
  const supplierName = (q: QuoteRow) =>
    q.supplier_id ? (suppliers.find((s) => s.id === q.supplier_id)?.name ?? (q.supplier_name || "مورّد")) : q.supplier_name || "مورّد";

  return (
    <div dir="rtl" className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* RFQs */}
      <section>
        <h2 className="mb-1 font-semibold text-white">طلبات عروض الأسعار (RFQ)</h2>
        <p className="mb-4 text-xs text-slate-500">اطلب عروضًا من الموردين لكل بند، قارن الأسعار، واعتمد الأفضل.</p>

        {canEdit && <RfqForm projectId={projectId} resetKey={rfqs.length} />}

        {rfqs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">لا توجد طلبات بعد.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {rfqs.map((r) => (
              <RfqCard
                key={r.id}
                rfq={r}
                projectId={projectId}
                currency={currency}
                canEdit={canEdit}
                suppliers={suppliers}
                quotes={quotes.filter((q) => q.rfq_id === r.id)}
                supplierName={supplierName}
              />
            ))}
          </div>
        )}
      </section>

      {/* Suppliers directory */}
      <section className="card h-fit p-4">
        <button type="button" onClick={() => setShowSuppliers((v) => !v)} className="flex w-full items-center justify-between">
          <h3 className="font-semibold text-white">دليل الموردين <span className="text-xs text-slate-500">({suppliers.length})</span></h3>
          <ChevronDown size={16} className={`text-slate-400 transition ${showSuppliers ? "rotate-180" : ""}`} />
        </button>

        {showSuppliers && (
          <div className="mt-3 space-y-3">
            {canEdit && <SupplierForm organizationId={organizationId} resetKey={suppliers.length} />}
            <ul className="divide-y divide-slate-800">
              {suppliers.map((s) => (
                <li key={s.id} className="flex items-start gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{s.name}</p>
                    <p className="text-xs text-slate-500">{[s.category, s.phone].filter(Boolean).join(" · ")}</p>
                    {s.rating > 0 && <Stars n={s.rating} />}
                  </div>
                  {canEdit && <DeleteBtn onClick={() => deleteSupplier(s.id)} label={`حذف ${s.name}`} />}
                </li>
              ))}
              {suppliers.length === 0 && <li className="py-2 text-xs text-slate-500">لا يوجد موردون بعد.</li>}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function DeleteBtn({ onClick, label }: { onClick: () => void; label: string }) {
  const [busy, start] = useTransition();
  return (
    <button type="button" aria-label={label} disabled={busy} onClick={() => confirm(`${label}؟`) && start(onClick)} className="shrink-0 text-slate-500 hover:text-red-400">
      <Trash2 size={14} />
    </button>
  );
}

function RfqForm({ projectId, resetKey }: { projectId: string; resetKey: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addRfq.bind(null, projectId), {});
  return (
    <form action={action} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 sm:grid-cols-[1fr_1fr_auto]" key={resetKey}>
      <input name="title" required placeholder="عنوان الطلب (مثال: الصوت والإضاءة)" aria-label="عنوان الطلب" className="field sm:col-span-2" />
      <input name="category" placeholder="التصنيف" aria-label="التصنيف" className="field" />
      <input name="due_date" type="date" aria-label="آخر موعد" className="field" />
      <button className="btn-primary" disabled={pending}>{pending ? "…" : "إضافة طلب"}</button>
      {state.error && <p className="text-sm text-red-400 sm:col-span-3">{state.error}</p>}
    </form>
  );
}

function RfqCard({
  rfq, projectId, currency, canEdit, suppliers, quotes, supplierName,
}: {
  rfq: RfqRow;
  projectId: string;
  currency: string;
  canEdit: boolean;
  suppliers: SupplierRow[];
  quotes: QuoteRow[];
  supplierName: (q: QuoteRow) => string;
}) {
  const [busy, start] = useTransition();
  const priced = quotes.filter((q) => q.amount != null && q.status !== "rejected");
  const lowest = priced.length ? Math.min(...priced.map((q) => q.amount!)) : null;
  const st = RFQ_STATUS[rfq.status];

  return (
    <div className="card p-4" data-testid="rfq">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-white">{rfq.title}</h3>
        {rfq.category && <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{rfq.category}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs ${st.tone}`}>{st.label}</span>
        {rfq.due_date && <span className="text-xs text-slate-500">آخر موعد: {formatDate(rfq.due_date)}</span>}
        {canEdit && (
          <div className="ms-auto flex items-center gap-2">
            <select
              aria-label="حالة الطلب"
              value={rfq.status}
              disabled={busy}
              onChange={(e) => start(() => updateRfq(rfq.id, { status: e.target.value as RfqStatus }))}
              className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
            >
              {Object.entries(RFQ_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
            </select>
            <DeleteBtn onClick={() => deleteRfq(rfq.id)} label={`حذف طلب ${rfq.title}`} />
          </div>
        )}
      </div>

      {quotes.length > 0 && (
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-500">
              <th className="px-1 py-1 font-medium">المورّد</th>
              <th className="px-1 py-1 font-medium">السعر</th>
              <th className="px-1 py-1 font-medium">الحالة</th>
              {canEdit && <th className="px-1 py-1" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {quotes.map((q) => {
              const isLow = q.amount != null && q.amount === lowest && q.status !== "rejected";
              return (
                <tr key={q.id} className={q.status === "rejected" ? "text-slate-600" : "text-slate-200"}>
                  <td className="px-1 py-1.5">
                    {supplierName(q)}
                    {isLow && <span className="ms-1 rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-300">الأقل</span>}
                  </td>
                  <td className={`px-1 py-1.5 ${q.status === "accepted" ? "font-bold text-emerald-300" : ""}`}>
                    {q.amount != null ? formatMoney(q.amount, currency) : "—"}
                  </td>
                  <td className="px-1 py-1.5 text-xs">
                    {q.status === "accepted" ? <span className="text-emerald-400">معتمد ✓</span> : q.status === "rejected" ? "مرفوض" : "مستلم"}
                  </td>
                  {canEdit && (
                    <td className="px-1 py-1.5">
                      <div className="flex items-center justify-end gap-2">
                        {q.status !== "accepted" && (
                          <button type="button" aria-label={`اعتماد ${supplierName(q)}`} disabled={busy} onClick={() => start(() => acceptQuote(rfq.id, q.id))} className="text-slate-500 hover:text-emerald-400"><Check size={15} /></button>
                        )}
                        <DeleteBtn onClick={() => deleteQuote(q.id)} label={`حذف عرض ${supplierName(q)}`} />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {canEdit && <QuoteForm projectId={projectId} rfqId={rfq.id} suppliers={suppliers} resetKey={quotes.length} />}
    </div>
  );
}

function QuoteForm({ projectId, rfqId, suppliers, resetKey }: { projectId: string; rfqId: string; suppliers: SupplierRow[]; resetKey: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addQuote.bind(null, projectId, rfqId), {});
  return (
    <form action={action} className="mt-3 grid gap-2 border-t border-slate-800 pt-3 sm:grid-cols-[1fr_1fr_auto]" key={resetKey}>
      {suppliers.length > 0 ? (
        <select name="supplier_id" aria-label="المورّد" className="field" defaultValue="">
          <option value="">— اختر مورّدًا —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      ) : (
        <input name="supplier_name" placeholder="اسم المورّد" aria-label="اسم المورّد" className="field" />
      )}
      <input name="amount" inputMode="decimal" placeholder="السعر" aria-label="السعر" className="field" />
      <button className="btn-ghost shrink-0" disabled={pending}>{pending ? "…" : "إضافة عرض"}</button>
      {suppliers.length > 0 && <input name="supplier_name" placeholder="أو اكتب اسم مورّد جديد" aria-label="اسم مورّد جديد" className="field sm:col-span-3" />}
      {state.error && <p className="text-sm text-red-400 sm:col-span-3">{state.error}</p>}
    </form>
  );
}

function SupplierForm({ organizationId, resetKey }: { organizationId: string; resetKey: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addSupplier.bind(null, organizationId), {});
  return (
    <form action={action} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3" key={resetKey}>
      <input name="name" required placeholder="اسم المورّد" aria-label="اسم المورّد" className="field" />
      <div className="grid grid-cols-2 gap-2">
        <input name="category" placeholder="التصنيف (ضيافة، AVL…)" aria-label="التصنيف" className="field" />
        <input name="phone" placeholder="الهاتف" aria-label="الهاتف" dir="ltr" className="field" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="contact_name" placeholder="جهة التواصل" aria-label="جهة التواصل" className="field" />
        <input name="rating" inputMode="numeric" placeholder="التقييم 0-5" aria-label="التقييم" className="field" />
      </div>
      <button className="btn-primary" disabled={pending}>{pending ? "…" : "إضافة مورّد"}</button>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
