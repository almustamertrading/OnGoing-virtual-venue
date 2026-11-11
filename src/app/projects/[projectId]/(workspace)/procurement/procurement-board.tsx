"use client";

import { useActionState, useState, useTransition } from "react";
import { Award, ChevronDown, Lock, Pencil, Scale, Star, Trash2 } from "lucide-react";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { compareQuotes, SCOPE_BASIS_LABEL, type ScopeBasis } from "@/lib/quote-compare";
import type { QuoteRow, RfqRow, RfqStatus, SupplierRow } from "@/lib/types";
import type { ActionState } from "../../../actions";
import {
  addQuote, addRfq, addSupplier, awardQuote,
  deleteQuote, deleteRfq, deleteSupplier, updateQuoteDetails, updateRfq,
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
  projectId, organizationId, currency, canEdit, canSeeQuotes, canManageSuppliers, canDeleteSuppliers, suppliers, rfqs, quotes,
  eventStart, today, people,
}: {
  projectId: string;
  organizationId: string;
  currency: string;
  canEdit: boolean;
  /** Supplier quotes are internal costs (finance only). */
  canSeeQuotes: boolean;
  canManageSuppliers: boolean;
  /** Matches the delete policy: organisation admins and managers. */
  canDeleteSuppliers: boolean;
  suppliers: SupplierRow[];
  rfqs: RfqRow[];
  quotes: QuoteRow[];
  /** Project start: deliveries arriving later are flagged. */
  eventStart: string | null;
  today: string;
  /** User id → email, for award records. */
  people: Record<string, string>;
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
                canSeeQuotes={canSeeQuotes}
                suppliers={suppliers}
                quotes={quotes.filter((q) => q.rfq_id === r.id)}
                supplierName={supplierName}
                eventStart={eventStart}
                today={today}
                people={people}
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
            {canManageSuppliers && <SupplierForm organizationId={organizationId} resetKey={suppliers.length} />}
            <ul className="divide-y divide-slate-800">
              {suppliers.map((s) => (
                <li key={s.id} className="flex items-start gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{s.name}</p>
                    <p className="text-xs text-slate-500">{[s.category, s.phone].filter(Boolean).join(" · ")}</p>
                    {s.rating > 0 && <Stars n={s.rating} />}
                  </div>
                  {canDeleteSuppliers && <DeleteBtn onClick={() => deleteSupplier(s.id)} label={`حذف ${s.name}`} />}
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
  rfq, projectId, currency, canEdit, canSeeQuotes, suppliers, quotes, supplierName, eventStart, today, people,
}: {
  rfq: RfqRow;
  projectId: string;
  currency: string;
  canEdit: boolean;
  canSeeQuotes: boolean;
  suppliers: SupplierRow[];
  quotes: QuoteRow[];
  supplierName: (q: QuoteRow) => string;
  eventStart: string | null;
  today: string;
  people: Record<string, string>;
}) {
  const [busy, start] = useTransition();
  const st = RFQ_STATUS[rfq.status];
  // Managing quotes also awards the RFQ, so it needs both finance and project edit rights.
  const canManageQuotes = canSeeQuotes && canEdit;
  const comparison = compareQuotes(
    quotes.map((q) => ({
      id: q.id, supplier: supplierName(q), amount: q.amount === null ? null : Number(q.amount), status: q.status,
      scope_basis: q.scope_basis, exclusions: q.exclusions, valid_until: q.valid_until, lead_time_days: q.lead_time_days,
      payment_terms: q.payment_terms,
    })),
    { today, eventStart },
  );
  const awarded = quotes.find((q) => q.status === "accepted");
  const recommended = comparison.recommendation.quoteId ? quotes.find((q) => q.id === comparison.recommendation.quoteId) : undefined;

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

      {!canSeeQuotes && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500" data-testid="quotes-restricted">
          <Lock size={12} aria-hidden /> عروض الموردين وأسعارها مقيدة بصلاحية المالية.
        </p>
      )}

      {canSeeQuotes && quotes.length > 0 && (
        <div className="space-y-3" data-testid="quote-comparison">
          {awarded ? (
            <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-200" data-testid="award-record">
              <Award size={14} className="me-1 inline" aria-hidden />
              رُسّي على <strong>{supplierName(awarded)}</strong>
              {awarded.awarded_by && <> بواسطة {people[awarded.awarded_by] ?? "عضو"}</>}
              {awarded.awarded_at && <> · <bdi>{formatDateTime(awarded.awarded_at)}</bdi></>}
              {awarded.award_reason && <span className="mt-1 block text-xs text-emerald-300/90">السبب: {awarded.award_reason}</span>}
            </p>
          ) : (
            <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 p-3 text-sm" data-testid="recommendation">
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-sky-200">
                <Scale size={13} aria-hidden /> توصية آلية من البيانات المُدخلة فقط · الترسية قرار المخوّل
              </p>
              <p className="text-slate-200">{recommended ? <>الأنسب: <strong>{supplierName(recommended)}</strong></> : "لا توصية حاليًا"}</p>
              <ul className="mt-1 list-disc space-y-0.5 pe-4 ps-5 text-xs text-slate-400">
                {comparison.recommendation.reasons.map((r) => <li key={r}>{r}</li>)}
                {comparison.recommendation.caveats.map((c) => <li key={c} className="text-amber-300/90">تنبيه: {c}</li>)}
              </ul>
            </div>
          )}
          {comparison.notes.map((n) => <p key={n} className="text-xs text-amber-300">{n}</p>)}

          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th className="px-1 py-1 font-medium">المورّد</th>
                  <th className="px-1 py-1 font-medium">السعر</th>
                  <th className="px-1 py-1 font-medium">الأساس</th>
                  <th className="px-1 py-1 font-medium">الصلاحية</th>
                  <th className="px-1 py-1 font-medium">التوريد</th>
                  <th className="px-1 py-1 font-medium">الدفع</th>
                  <th className="px-1 py-1 font-medium">ملاحظات</th>
                  {canManageQuotes && <th className="px-1 py-1" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {comparison.rows.map((row) => {
                  const q = quotes.find((x) => x.id === row.quote.id)!;
                  return (
                    <QuoteComparisonRow
                      key={q.id}
                      quote={q}
                      name={supplierName(q)}
                      row={row}
                      currency={currency}
                      canManage={canManageQuotes}
                      onDelete={() => deleteQuote(q.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManageQuotes && <QuoteForm projectId={projectId} rfqId={rfq.id} suppliers={suppliers} resetKey={quotes.length} />}
    </div>
  );
}

const FLAG_TONE = { critical: "bg-red-950 text-red-200", warning: "bg-amber-950 text-amber-200", info: "bg-slate-800 text-slate-300" } as const;

function QuoteComparisonRow({
  quote, name, row, currency, canManage, onDelete,
}: {
  quote: QuoteRow;
  name: string;
  row: ReturnType<typeof compareQuotes>["rows"][number];
  currency: string;
  canManage: boolean;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"none" | "edit" | "award">("none");
  const rejected = quote.status === "rejected";
  const accepted = quote.status === "accepted";
  const cols = canManage ? 8 : 7;
  return (
    <>
      <tr className={rejected ? "text-slate-500" : "text-slate-200"} data-testid="quote-row">
        <td className="px-1 py-1.5">
          {name}
          {row.lowest && <span className="ms-1 rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-300">الأقل</span>}
          {accepted && <span className="ms-1 rounded bg-emerald-600/30 px-1 text-[10px] text-emerald-200">مُرسّى</span>}
          {rejected && <span className="ms-1 text-[10px]">(مستبعد)</span>}
        </td>
        <td className={`px-1 py-1.5 ${accepted ? "font-bold text-emerald-300" : ""}`}>
          {quote.amount !== null ? formatMoney(Number(quote.amount), currency) : "—"}
          {row.abovePct !== null && <span className="ms-1 text-[10px] text-slate-500">+{row.abovePct}%</span>}
        </td>
        <td className="px-1 py-1.5 text-xs">{SCOPE_BASIS_LABEL[quote.scope_basis]}</td>
        <td className="px-1 py-1.5 text-xs">{quote.valid_until ? <bdi>{formatDate(quote.valid_until)}</bdi> : "—"}</td>
        <td className="px-1 py-1.5 text-xs">{quote.lead_time_days !== null ? <>{quote.lead_time_days} يوم{row.deliveryDate && <span className="block text-[10px] text-slate-500"><bdi>{formatDate(row.deliveryDate)}</bdi></span>}</> : "—"}</td>
        <td className="px-1 py-1.5 text-xs">{quote.payment_terms || "—"}</td>
        <td className="px-1 py-1.5">
          <div className="flex flex-wrap gap-1">
            {row.flags.map((f) => <span key={f.code} className={`rounded px-1 text-[10px] ${FLAG_TONE[f.severity]}`}>{f.message}</span>)}
          </div>
        </td>
        {canManage && (
          <td className="px-1 py-1.5">
            <div className="flex items-center justify-end gap-2">
              <button type="button" aria-label={`تفاصيل عرض ${name}`} onClick={() => setMode(mode === "edit" ? "none" : "edit")} className="text-slate-500 hover:text-white"><Pencil size={14} /></button>
              {!accepted && quote.amount !== null && (
                <button type="button" aria-label={`ترسية على ${name}`} onClick={() => setMode(mode === "award" ? "none" : "award")} className="text-slate-500 hover:text-emerald-400"><Award size={15} /></button>
              )}
              <DeleteBtn onClick={onDelete} label={`حذف عرض ${name}`} />
            </div>
          </td>
        )}
      </tr>
      {mode !== "none" && (
        <tr>
          <td colSpan={cols} className="bg-slate-950/60 px-2 py-3">
            {mode === "edit" ? <QuoteDetailsForm quote={quote} name={name} onDone={() => setMode("none")} /> : <AwardForm quote={quote} name={name} onDone={() => setMode("none")} />}
          </td>
        </tr>
      )}
    </>
  );
}

function QuoteDetailsForm({ quote, name, onDone }: { quote: QuoteRow; name: string; onDone: () => void }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (f: FormData) =>
    start(async () => {
      setError(null);
      const lead = String(f.get("lead_time_days") ?? "").trim();
      const amount = String(f.get("amount") ?? "").replace(/[, ]/g, "").trim();
      const r = await updateQuoteDetails(quote.id, {
        amount: amount ? Number(amount) : null,
        scope_basis: String(f.get("scope_basis")) as ScopeBasis,
        exclusions: String(f.get("exclusions") ?? ""),
        valid_until: String(f.get("valid_until") ?? "") || null,
        lead_time_days: lead ? Number(lead) : null,
        payment_terms: String(f.get("payment_terms") ?? ""),
      });
      if (r.error) setError(r.error);
      else onDone();
    });
  return (
    <form action={submit} className="grid gap-2 sm:grid-cols-3" aria-label={`تفاصيل عرض ${name}`}>
      <label className="text-xs text-slate-400">السعر<input name="amount" inputMode="decimal" defaultValue={quote.amount ?? ""} className="field mt-1" /></label>
      <label className="text-xs text-slate-400">أساس التسعير
        <select name="scope_basis" defaultValue={quote.scope_basis} className="field mt-1">
          {(Object.keys(SCOPE_BASIS_LABEL) as ScopeBasis[]).map((b) => <option key={b} value={b}>{SCOPE_BASIS_LABEL[b]}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate-400">صالح حتى<input name="valid_until" type="date" defaultValue={quote.valid_until ?? ""} className="field mt-1" /></label>
      <label className="text-xs text-slate-400">مدة التوريد (أيام)<input name="lead_time_days" type="number" min={0} max={730} defaultValue={quote.lead_time_days ?? ""} className="field mt-1" /></label>
      <label className="text-xs text-slate-400">شروط الدفع<input name="payment_terms" maxLength={300} defaultValue={quote.payment_terms} className="field mt-1" /></label>
      <label className="text-xs text-slate-400 sm:col-span-3">الاستثناءات (ما لا يشمله العرض)<textarea name="exclusions" rows={2} maxLength={2000} defaultValue={quote.exclusions} className="field mt-1" /></label>
      <div className="flex gap-2 sm:col-span-3">
        <button className="btn-primary" disabled={busy}>{busy ? "…" : "حفظ التفاصيل"}</button>
        <button type="button" className="btn-ghost" onClick={onDone}>إلغاء</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-400 sm:col-span-3">{error}</p>}
    </form>
  );
}

function AwardForm({ quote, name, onDone }: { quote: QuoteRow; name: string; onDone: () => void }) {
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2" role="group" aria-label={`ترسية على ${name}`}>
      <p className="text-xs text-slate-300">ترسية الطلب على <strong>{name}</strong>. تُستبعد باقي العروض ويُسجَّل اسمك ووقت القرار وسببه.</p>
      <label className="sr-only" htmlFor={`award-${quote.id}`}>سبب الترسية</label>
      <input id={`award-${quote.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000}
        placeholder="سبب الترسية (إلزامي)، مثال: أقل سعر مكتمل والتوريد قبل موعد الفعالية" className="field" />
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={busy || !reason.trim()}
          onClick={() => start(async () => { setError(null); const r = await awardQuote(quote.id, reason); if (r.error) setError(r.error); else onDone(); })}>
          {busy ? "…" : "تأكيد الترسية"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>إلغاء</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
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
