"use client";

import Link from "next/link";
import { useActionState, useMemo, useTransition } from "react";
import { ChevronRight, Download, FileText, Lock, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { BoqCheckPanel } from "@/components/boq-check-panel";
import type { AiStatus } from "@/lib/ai/status";
import { formatMoney } from "@/lib/format";
import { PROPOSAL_STATUS, PROPOSAL_TYPE } from "@/lib/proposal-meta";
import { isEditable } from "@/lib/proposal-workflow";
import type {
  ClientRow, ProposalItemRow, ProposalReviewRow, ProposalRow, ProposalSectionRow, ProposalVersionRow,
} from "@/lib/types";
import { lineTotal, proposalTotals } from "@/lib/money";
import {
  addItem, addSection, deleteItem, deleteProposal, deleteSection,
  generateDraft, setItemCost, updateItem, updateProposal, updateSection, type ActionState, type GenState,
} from "../actions";
import { HistoryPanel } from "./history-panel";
import { WorkflowPanel } from "./workflow-panel";

/** Item row ids, so the BOQ checker's findings link to their rows. */
const ITEM_ANCHOR = "proposal-item-";

export function ProposalWorkspace({
  email, companyName, currency, canEdit, isManager, canDelete, canSeeCost, proposal, sections, items, client,
  versions, reviews, people, templateName, aiStatus,
}: {
  email: string;
  companyName: string;
  currency: string;
  /** sales_access: edit content, items and prices (while the proposal is editable). */
  canEdit: boolean;
  /** Organisation admins and managers: review, approve, override the status. */
  isManager: boolean;
  /** Organisation admins and managers (the delete policy). */
  canDelete: boolean;
  /** finance_access: internal costs and margin. Without it, costs are never sent to the browser. */
  canSeeCost: boolean;
  proposal: ProposalRow;
  sections: ProposalSectionRow[];
  items: ProposalItemRow[];
  client: ClientRow | null;
  clients: ClientRow[];
  versions: ProposalVersionRow[];
  reviews: ProposalReviewRow[];
  people: Record<string, string>;
  templateName: string | null;
  aiStatus: AiStatus | null;
}) {
  const [busy, start] = useTransition();
  const orgId = proposal.organization_id;
  const m = (v: number) => formatMoney(v, currency);
  // Content follows the workflow: locked during review and after approval (the database agrees).
  const editable = canEdit && isEditable(proposal.status);

  const { subtotal, vat, grand, margin, marginPct } = proposalTotals(items, proposal.vat_rate);
  // The checker gets internal costs only when the viewer may see them (the page sends 0 otherwise).
  const boqLines = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        description: it.description,
        unit: it.unit,
        quantity: it.quantity,
        unit_price: it.unit_price,
        is_optional: it.is_optional,
        unit_cost: canSeeCost ? it.unit_cost : undefined,
      })),
    [items, canSeeCost],
  );

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
              <p className="font-mono text-xs text-slate-500">
                {proposal.reference} · {PROPOSAL_TYPE[proposal.proposal_type].label}
                {templateName && <span className="font-sans"> · قالب: {templateName}</span>}
              </p>
              <input
                aria-label="عنوان العرض"
                defaultValue={proposal.title}
                key={`title-${proposal.status}`}
                disabled={!editable}
                onBlur={(e) => e.target.value.trim() && e.target.value !== proposal.title && start(() => updateProposal(proposal.id, { title: e.target.value.trim() }))}
                className="mt-1 w-full border-0 bg-transparent text-2xl font-semibold text-white outline-none"
              />
              <p className="mt-1 text-sm text-slate-400">{client?.name ?? "بدون عميل"}{proposal.valid_until ? ` · صلاحية حتى ${proposal.valid_until}` : ""}</p>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-800 pt-4">
            <WorkflowPanel proposal={proposal} canEdit={canEdit} isManager={isManager} people={people} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/proposals/${proposal.id}/print`} target="_blank" rel="noreferrer" className="btn-ghost"><Download size={15} /> تصدير PDF</a>
            {proposal.project_id && <Link href={`/projects/${proposal.project_id}`} className="btn-ghost"><FileText size={15} /> المشروع المرتبط</Link>}
            {canDelete && (
              <button className="btn-ghost ms-auto text-red-400 hover:text-red-300" disabled={busy} onClick={() => confirm("حذف العرض نهائيًا؟") && start(() => deleteProposal(proposal.id))}>
                <Trash2 size={15} /> حذف
              </button>
            )}
          </div>
        </section>

        {canEdit && !editable && (
          <p role="status" className="mb-5 flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-300" data-testid="proposal-locked">
            <Lock size={16} className="mt-0.5 shrink-0 text-slate-400" />
            المحتوى مقفل لأن العرض «{PROPOSAL_STATUS[proposal.status].label}». لتعديله أعده إلى «مسودة»، وسيحتاج بعدها إلى مراجعة واعتماد جديدين.
          </p>
        )}

        {/* AI generator */}
        {editable && aiStatus && (
          <AiPanel proposalId={proposal.id} orgId={orgId} companyName={companyName} brief={proposal.brief} hasSections={sections.some((s) => s.body)} status={aiStatus} />
        )}

        {/* Executive summary */}
        {(proposal.summary || editable) && (
          <section className="card mb-5 p-5">
            <h2 className="mb-2 text-sm font-semibold text-emerald-300">الملخص التنفيذي</h2>
            {editable ? (
              <textarea key={`summary-${proposal.summary}`} aria-label="الملخص التنفيذي" defaultValue={proposal.summary} rows={3} placeholder="ملخص تنفيذي…" onBlur={(e) => e.target.value !== proposal.summary && start(() => updateProposal(proposal.id, { summary: e.target.value }))} className="field" />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-200">{proposal.summary}</p>
            )}
          </section>
        )}

        {/* Sections */}
        <section className="mb-5 space-y-3">
          <h2 className="font-semibold text-white">أقسام العرض</h2>
          {sections.map((s) => <SectionEditor key={s.id} section={s} canEdit={editable} />)}
          {editable && <AddSectionForm proposalId={proposal.id} orgId={orgId} resetKey={sections.length} />}
        </section>

        {/* Financial builder */}
        <section className="card p-5" data-testid="proposal-financial">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-white">جدول الكميات والتسعير (BOQ)</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              ض.ق.م:
              {editable ? (
                <input aria-label="نسبة ضريبة القيمة المضافة" defaultValue={proposal.vat_rate} inputMode="decimal" onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== proposal.vat_rate) start(() => updateProposal(proposal.id, { vat_rate: v })); }} className="w-14 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-center" />
              ) : proposal.vat_rate}%
            </div>
          </div>

          <BoqCheckPanel lines={boqLines} finance={canSeeCost} anchorPrefix={ITEM_ANCHOR} />

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
                    {editable && <th className="px-2 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {items.map((it) => <ItemRow key={it.id} item={it} currency={currency} canEdit={editable} canSeeCost={canSeeCost} />)}
                </tbody>
              </table>
            </div>
          )}

          {editable && <AddItemForm proposalId={proposal.id} orgId={orgId} resetKey={items.length} />}

          {/* Totals */}
          <div className={`mt-4 grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-2 ${canSeeCost ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            <Total k="الإجمالي قبل الضريبة" v={m(subtotal)} />
            <Total k={`ض.ق.م (${proposal.vat_rate}%)`} v={m(vat)} />
            <Total k="الإجمالي شامل الضريبة" v={m(grand)} tone="text-emerald-300" big />
            {canSeeCost && <Total k="الهامش (داخلي)" v={`${m(margin)} · ${marginPct}%`} tone={margin >= 0 ? "text-emerald-300" : "text-red-300"} />}
          </div>
          {canSeeCost && <p className="mt-2 text-[11px] text-slate-500">التكلفة الداخلية والهامش لا يظهران في PDF العميل ولا في نسخ العرض.</p>}
        </section>

        <div className="mt-5">
          <HistoryPanel
            proposal={proposal}
            versions={versions}
            reviews={reviews}
            people={people}
            canComment={canEdit || isManager}
            canSaveVersion={canEdit}
          />
        </div>
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

function AiPanel({
  proposalId, orgId, companyName, brief, hasSections, status,
}: {
  proposalId: string;
  orgId: string;
  companyName: string;
  brief: string;
  hasSections: boolean;
  status: AiStatus;
}) {
  const [state, action, pending] = useActionState<GenState, FormData>(generateDraft.bind(null, proposalId, orgId, companyName), {});
  const configured = status.provider !== null;
  const exhausted = status.usedThisHour >= status.perHour || status.usedToday >= status.perDay;
  return (
    <section className="card mb-5 border-violet-900/40 bg-violet-950/10 p-5" aria-labelledby="ai-title" data-testid="proposal-ai">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Sparkles size={16} className="text-violet-300" />
        <h2 id="ai-title" className="text-sm font-semibold text-violet-200">توليد المسودة بالذكاء الاصطناعي</h2>
        {status.provider === "mock" && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-300" title="AI_PROVIDER=mock">وضع تجريبي: محتوى اختبار وليس ذكاءً اصطناعيًا</span>
        )}
        {configured && (
          <span className="ms-auto text-[11px] text-slate-400" data-testid="ai-quota">
            طلباتك: {status.usedThisHour}/{status.perHour} هذه الساعة · {status.usedToday}/{status.perDay} اليوم
          </span>
        )}
      </div>
      {!configured ? (
        <p role="status" className="text-sm text-slate-400">الذكاء الاصطناعي غير مفعّل بعد على هذا الخادم: يلزم إضافة مفتاح الخدمة في إعداداته. يمكنك كتابة الأقسام يدويًا.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-400">
            الصق موجز العميل أو متطلباته، ويولّد Claude مسودة أقسام احترافية. يُعلّم الافتراضات (⚠️) ولا يختلق أسعارًا أو مراجع أو اعتمادات.
          </p>
          <form action={action} className="space-y-3">
            <label htmlFor="ai-brief" className="sr-only">موجز العميل</label>
            <textarea id="ai-brief" name="brief" rows={4} defaultValue={brief} required minLength={30} placeholder="موجز العميل / المتطلبات…" className="field" />
            {state.code === "duplicate" && (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" name="force" className="accent-violet-500" /> إعادة التوليد رغم التطابق (يُحتسب طلبًا جديدًا)
              </label>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" disabled={pending || exhausted}>
                <Wand2 size={15} /> {pending ? "جارٍ التوليد… قد يستغرق دقيقة" : hasSections ? "إعادة التوليد" : "توليد المسودة"}
              </button>
              {hasSections && <span className="text-xs text-amber-400">تُحفظ نسخة من الأقسام الحالية ثم تُستبدل.</span>}
            </div>
            <div aria-live="polite">
              {exhausted && !state.error && <p className="text-sm text-amber-400">بلغت الحد المسموح من الطلبات حاليًا. حاول لاحقًا.</p>}
              {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
              {state.ok && <p className="text-sm text-emerald-400">تم توليد المسودة ✓</p>}
            </div>
          </form>
        </>
      )}
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
  const total = lineTotal(item.quantity, item.unit_price) ?? 0;
  const cell = "w-20 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs";
  return (
    <tr id={`${ITEM_ANCHOR}${item.id}`} className={item.is_optional ? "text-slate-500" : "text-slate-200"}>
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
