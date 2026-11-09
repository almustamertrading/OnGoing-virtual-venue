"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { ChevronRight, Download, FileText, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { formatMoney } from "@/lib/format";
import { PROPOSAL_STATUS, PROPOSAL_TYPE } from "@/lib/proposal-meta";
import type { ClientRow, ProposalItemRow, ProposalRow, ProposalSectionRow, ProposalStatus } from "@/lib/types";
import {
  addItem, addSection, convertToProject, deleteItem, deleteProposal, deleteSection,
  generateDraft, setItemCost, updateItem, updateProposal, updateSection, type ActionState, type GenState,
} from "../actions";

export function ProposalWorkspace({
  email, companyName, currency, canEdit, canDelete, canSeeCost, proposal, sections, items, client,
}: {
  email: string;
  companyName: string;
  currency: string;
  /** sales_access: edit content, items and prices. */
  canEdit: boolean;
  /** Organisation admins and managers (the delete policy). */
  canDelete: boolean;
  /** finance_access: internal costs and margin. Without it, costs are never sent to the browser. */
  canSeeCost: boolean;
  proposal: ProposalRow;
  sections: ProposalSectionRow[];
  items: ProposalItemRow[];
  client: ClientRow | null;
  clients: ClientRow[];
}) {
  const [busy, start] = useTransition();
  const orgId = proposal.organization_id;
  const m = (v: number) => formatMoney(v, currency);

  const billable = items.filter((i) => !i.is_optional);
  const subtotal = billable.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const cost = billable.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const vat = subtotal * (proposal.vat_rate / 100);
  const grand = subtotal + vat;
  const margin = subtotal - cost;
  const marginPct = subtotal ? Math.round((margin / subtotal) * 100) : 0;

  const canConvert = ["approved_internally", "accepted"].includes(proposal.status) && !proposal.project_id;

  return (
    <>
      <AppHeader email={email}>
        <Link href="/proposals" className="hover:text-white">Proposals</Link>
        <ChevronRight size={14} />
        <span className="font-mono text-slate-200">{proposal.reference}</span>
      </AppHeader>

      <main dir="rtl" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {/* Header card */}
        <section className="card mb-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-slate-500">{proposal.reference} · {PROPOSAL_TYPE[proposal.proposal_type].label}</p>
              <input
                defaultValue={proposal.title}
                disabled={!canEdit}
                onBlur={(e) => e.target.value.trim() && e.target.value !== proposal.title && start(() => updateProposal(proposal.id, { title: e.target.value.trim() }))}
                className="mt-1 w-full border-0 bg-transparent text-2xl font-semibold text-white outline-none"
              />
              <p className="mt-1 text-sm text-slate-400">{client?.name ?? "بدون عميل"}{proposal.valid_until ? ` · صلاحية حتى ${proposal.valid_until}` : ""}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {canEdit ? (
                <select value={proposal.status} disabled={busy} onChange={(e) => start(() => updateProposal(proposal.id, { status: e.target.value as ProposalStatus }))} className="field w-44">
                  {Object.entries(PROPOSAL_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              ) : (
                <span className={`rounded-full px-2 py-0.5 text-xs ${PROPOSAL_STATUS[proposal.status].tone}`}>{PROPOSAL_STATUS[proposal.status].label}</span>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/proposals/${proposal.id}/print`} target="_blank" rel="noreferrer" className="btn-ghost"><Download size={15} /> تصدير PDF</a>
            {canConvert && (
              <button className="btn-primary" disabled={busy} onClick={() => confirm("تحويل العرض إلى مشروع تشغيلي؟") && start(() => convertToProject(proposal.id))}>
                <FileText size={15} /> تحويل إلى مشروع
              </button>
            )}
            {proposal.project_id && <Link href={`/projects/${proposal.project_id}`} className="btn-ghost"><FileText size={15} /> المشروع المرتبط</Link>}
            {canDelete && (
              <button className="btn-ghost ms-auto text-red-400 hover:text-red-300" disabled={busy} onClick={() => confirm("حذف العرض نهائيًا؟") && start(() => deleteProposal(proposal.id))}>
                <Trash2 size={15} /> حذف
              </button>
            )}
          </div>
        </section>

        {/* AI generator */}
        {canEdit && <AiPanel proposalId={proposal.id} orgId={orgId} companyName={companyName} brief={proposal.brief} hasSections={sections.some((s) => s.body)} />}

        {/* Executive summary */}
        {(proposal.summary || canEdit) && (
          <section className="card mb-5 p-5">
            <h2 className="mb-2 text-sm font-semibold text-emerald-300">الملخص التنفيذي</h2>
            {canEdit ? (
              <textarea defaultValue={proposal.summary} rows={3} placeholder="ملخص تنفيذي…" onBlur={(e) => e.target.value !== proposal.summary && start(() => updateProposal(proposal.id, { summary: e.target.value }))} className="field" />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-200">{proposal.summary}</p>
            )}
          </section>
        )}

        {/* Sections */}
        <section className="mb-5 space-y-3">
          <h2 className="font-semibold text-white">أقسام العرض</h2>
          {sections.map((s) => <SectionEditor key={s.id} section={s} canEdit={canEdit} />)}
          {canEdit && <AddSectionForm proposalId={proposal.id} orgId={orgId} resetKey={sections.length} />}
        </section>

        {/* Financial builder */}
        <section className="card p-5" data-testid="proposal-financial">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-white">جدول الكميات والتسعير (BOQ)</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              ض.ق.م:
              {canEdit ? (
                <input defaultValue={proposal.vat_rate} inputMode="decimal" onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== proposal.vat_rate) start(() => updateProposal(proposal.id, { vat_rate: v })); }} className="w-14 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-center" />
              ) : proposal.vat_rate}%
            </div>
          </div>

          {items.length > 0 && (
            <div className="-mx-2 overflow-x-auto">
              <table className={`w-full text-right text-sm ${canSeeCost ? "min-w-[760px]" : "min-w-[640px]"}`}>
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="px-2 py-2 font-medium">البند</th>
                    <th className="px-2 py-2 font-medium">الكمية</th>
                    <th className="px-2 py-2 font-medium">الوحدة</th>
                    {canSeeCost && <th className="px-2 py-2 font-medium" title="داخلي">التكلفة</th>}
                    <th className="px-2 py-2 font-medium">سعر البيع</th>
                    <th className="px-2 py-2 font-medium">الإجمالي</th>
                    {canEdit && <th className="px-2 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {items.map((it) => <ItemRow key={it.id} item={it} currency={currency} canEdit={canEdit} canSeeCost={canSeeCost} />)}
                </tbody>
              </table>
            </div>
          )}

          {canEdit && <AddItemForm proposalId={proposal.id} orgId={orgId} resetKey={items.length} />}

          {/* Totals */}
          <div className={`mt-4 grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-2 ${canSeeCost ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            <Total k="الإجمالي قبل الضريبة" v={m(subtotal)} />
            <Total k={`ض.ق.م (${proposal.vat_rate}%)`} v={m(vat)} />
            <Total k="الإجمالي شامل الضريبة" v={m(grand)} tone="text-emerald-300" big />
            {canSeeCost && <Total k="الهامش (داخلي)" v={`${m(margin)} · ${marginPct}%`} tone={margin >= 0 ? "text-emerald-300" : "text-red-300"} />}
          </div>
          {canSeeCost && <p className="mt-2 text-[11px] text-slate-500">التكلفة الداخلية والهامش لا يظهران في PDF العميل.</p>}
        </section>
      </main>
    </>
  );
}

function Total({ k, v, tone, big }: { k: string; v: string; tone?: string; big?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs text-slate-500">{k}</p>
      <p className={`mt-1 font-bold ${big ? "text-lg" : "text-sm"} ${tone ?? "text-white"}`}>{v}</p>
    </div>
  );
}

function AiPanel({ proposalId, orgId, companyName, brief, hasSections }: { proposalId: string; orgId: string; companyName: string; brief: string; hasSections: boolean }) {
  const [state, action, pending] = useActionState<GenState, FormData>(generateDraft.bind(null, proposalId, orgId, companyName), {});
  return (
    <section className="card mb-5 border-violet-900/40 bg-violet-950/10 p-5">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={16} className="text-violet-300" />
        <h2 className="text-sm font-semibold text-violet-200">توليد المسودة بالذكاء الاصطناعي</h2>
      </div>
      <p className="mb-3 text-xs text-slate-400">الصق موجز العميل أو متطلباته، ويولّد Claude مسودة أقسام احترافية. يُعلّم الافتراضات (⚠️) ولا يختلق أسعارًا أو مراجع أو اعتمادات.</p>
      <form action={action} className="space-y-3">
        <textarea name="brief" rows={4} defaultValue={brief} required placeholder="موجز العميل / المتطلبات…" className="field" />
        <div className="flex items-center gap-2">
          <button className="btn-primary" disabled={pending}><Wand2 size={15} /> {pending ? "جارٍ التوليد…" : hasSections ? "إعادة التوليد" : "توليد المسودة"}</button>
          {hasSections && <span className="text-xs text-amber-400">إعادة التوليد تستبدل الأقسام الحالية.</span>}
        </div>
        {state.error && <p className="text-sm text-red-400">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-400">تم توليد المسودة ✓</p>}
      </form>
    </section>
  );
}

function SectionEditor({ section, canEdit }: { section: ProposalSectionRow; canEdit: boolean }) {
  const [busy, start] = useTransition();
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        {canEdit ? (
          <input defaultValue={section.heading} onBlur={(e) => e.target.value !== section.heading && start(() => updateSection(section.id, { heading: e.target.value }))} className="flex-1 border-0 bg-transparent font-semibold text-white outline-none" />
        ) : (
          <h3 className="flex-1 font-semibold text-white">{section.heading}</h3>
        )}
        {section.ai_generated && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">AI</span>}
        {canEdit && <button type="button" aria-label="حذف القسم" disabled={busy} onClick={() => confirm("حذف القسم؟") && start(() => deleteSection(section.id))} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>}
      </div>
      {canEdit ? (
        <textarea defaultValue={section.body} rows={Math.max(3, Math.min(14, section.body.split("\n").length + 1))} placeholder="محتوى القسم…" onBlur={(e) => e.target.value !== section.body && start(() => updateSection(section.id, { body: e.target.value }))} className="field" />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-slate-200">{section.body}</p>
      )}
    </div>
  );
}

function AddSectionForm({ proposalId, orgId, resetKey }: { proposalId: string; orgId: string; resetKey: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addSection.bind(null, proposalId, orgId), {});
  return (
    <form action={action} className="flex gap-2" key={resetKey}>
      <input name="heading" required placeholder="عنوان قسم جديد" aria-label="عنوان قسم" className="field" />
      <button className="btn-ghost shrink-0" disabled={pending}><Plus size={15} /> قسم</button>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}

const n = (v: string) => { const r = v.replace(/[, ]/g, "").trim(); if (!r) return null; const x = Number(r); return Number.isFinite(x) && x >= 0 ? x : null; };

function ItemRow({ item, currency, canEdit, canSeeCost }: { item: ProposalItemRow; currency: string; canEdit: boolean; canSeeCost: boolean }) {
  const [busy, start] = useTransition();
  const total = item.quantity * item.unit_price;
  const cell = "w-20 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs";
  return (
    <tr className={item.is_optional ? "text-slate-500" : "text-slate-200"}>
      <td className="px-2 py-2">
        {canEdit ? <input defaultValue={item.description} aria-label="البند" onBlur={(e) => e.target.value.trim() && e.target.value !== item.description && start(() => updateItem(item.id, { description: e.target.value.trim() }))} className="w-44 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs" /> : item.description}
        {item.is_optional && <span className="ms-1 text-[10px] text-slate-500">(اختياري)</span>}
      </td>
      <td className="px-2 py-2">{canEdit ? <input defaultValue={item.quantity} inputMode="decimal" aria-label="الكمية" onBlur={(e) => { const v = n(e.target.value); if (v !== null && v !== item.quantity) start(() => updateItem(item.id, { quantity: v })); }} className={cell} /> : item.quantity}</td>
      <td className="px-2 py-2 text-slate-400">{canEdit ? <input defaultValue={item.unit} aria-label="الوحدة" onBlur={(e) => e.target.value !== item.unit && start(() => updateItem(item.id, { unit: e.target.value }))} className="w-16 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs" /> : item.unit || "—"}</td>
      {canSeeCost && (
        <td className="px-2 py-2 text-amber-300/80">
          <input defaultValue={item.unit_cost} inputMode="decimal" aria-label="التكلفة" onBlur={(e) => { const v = n(e.target.value); if (v !== null && v !== item.unit_cost) start(() => setItemCost(item.id, item.organization_id, v)); }} className={cell} />
        </td>
      )}
      <td className="px-2 py-2">{canEdit ? <input defaultValue={item.unit_price} inputMode="decimal" aria-label="سعر البيع" onBlur={(e) => { const v = n(e.target.value); if (v !== null && v !== item.unit_price) start(() => updateItem(item.id, { unit_price: v })); }} className={cell} /> : formatMoney(item.unit_price, currency)}</td>
      <td className="px-2 py-2 font-medium text-emerald-300">{formatMoney(total, currency)}</td>
      {canEdit && (
        <td className="px-2 py-2">
          <button type="button" aria-label="حذف البند" disabled={busy} onClick={() => start(() => deleteItem(item.id))} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
        </td>
      )}
    </tr>
  );
}

function AddItemForm({ proposalId, orgId, resetKey }: { proposalId: string; orgId: string; resetKey: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addItem.bind(null, proposalId, orgId), {});
  return (
    <form action={action} className="mt-3 grid gap-2 border-t border-slate-800 pt-3 sm:grid-cols-[1fr_auto_auto_auto_auto]" key={resetKey}>
      <input name="description" required placeholder="وصف البند" aria-label="وصف البند" className="field" />
      <input name="quantity" inputMode="decimal" placeholder="الكمية" aria-label="الكمية" className="field w-20" />
      <input name="unit" placeholder="الوحدة" aria-label="الوحدة" className="field w-20" />
      <input name="unit_price" inputMode="decimal" placeholder="السعر" aria-label="السعر" className="field w-24" />
      <button className="btn-primary" disabled={pending}>{pending ? "…" : "إضافة"}</button>
      {state.error && <p className="text-sm text-red-400 sm:col-span-5">{state.error}</p>}
    </form>
  );
}
