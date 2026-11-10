"use client";

import { useActionState, useState, useTransition } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import type { AiStatus } from "@/lib/ai/status";
import { OPS_REPORT_KIND, RISK_KIND_LABEL, RISK_LEVEL_LABEL, RISK_STATUS_LABEL, type OpsReportKind } from "@/lib/ops";
import type { MemberRow, OpsReportRow, ProjectRiskRow } from "@/lib/types";
import {
  addRisk, createReport, deleteReport, deleteRisk, extractReport, updateReport, updateRisk, type OpsState,
} from "./actions";

const KINDS = Object.keys(OPS_REPORT_KIND) as OpsReportKind[];

/** Create (no report) or edit (report given) an operations report. */
export function ReportForm({
  projectId, organizationId, report, today,
}: {
  projectId: string;
  organizationId: string;
  report?: OpsReportRow;
  today: string;
}) {
  const action = report ? updateReport.bind(null, report.id) : createReport.bind(null, projectId, organizationId);
  const [state, formAction, pending] = useActionState<OpsState, FormData>(action, {});
  const [busy, start] = useTransition();
  return (
    <form action={formAction} className="card space-y-3 p-5" aria-label={report ? "تعديل التقرير" : "تقرير جديد"} data-testid="report-form">
      <h2 className="font-semibold text-white">{report ? "التقرير" : "تقرير ميداني جديد"}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate-400">النوع
          <select name="kind" defaultValue={report?.kind ?? "site_visit"} className="field mt-1">
            {KINDS.map((k) => <option key={k} value={k}>{OPS_REPORT_KIND[k]}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400 sm:col-span-2">العنوان
          <input name="title" required maxLength={300} defaultValue={report?.title ?? ""} className="field mt-1" placeholder="مثال: معاينة القاعة الرئيسية" />
        </label>
        <label className="text-xs text-slate-400">التاريخ
          <input name="report_date" type="date" defaultValue={report?.report_date ?? today} className="field mt-1" />
        </label>
        <label className="text-xs text-slate-400">الموقع
          <input name="location" maxLength={300} defaultValue={report?.location ?? ""} className="field mt-1" />
        </label>
        <label className="text-xs text-slate-400">الحضور
          <input name="attendees" maxLength={1000} defaultValue={report?.attendees ?? ""} className="field mt-1" />
        </label>
      </div>
      <label className="block text-xs text-slate-400">الملاحظات
        <textarea name="body" rows={report ? 10 : 6} maxLength={20000} defaultValue={report?.body ?? ""} className="field mt-1"
          placeholder="ما الذي رأيته أو نوقش؟ اذكر المشكلات والمخاطر والإجراءات المطلوبة ومن سيقوم بها ومتى." />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "…" : report ? "حفظ التقرير" : "إنشاء التقرير"}</button>
        {report && (
          <button type="button" className="btn-ghost ms-auto text-red-400 hover:text-red-300" disabled={busy}
            onClick={() => confirm("حذف التقرير؟ تبقى المهام والمخاطر التي أُنشئت منه.") && start(async () => { await deleteReport(projectId, report.id); })}>
            <Trash2 size={15} /> حذف
          </button>
        )}
      </div>
      <div aria-live="polite">
        {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        {state.ok && state.message && <p role="status" className="text-sm text-emerald-400">{state.message}</p>}
      </div>
    </form>
  );
}

/** Runs the AI extraction of action items, issues, risks and decisions from the report's text. */
export function OpsExtractPanel({ projectId, reportId, status }: { projectId: string; reportId: string; status: AiStatus }) {
  const [state, action, pending] = useActionState<OpsState, FormData>(extractReport.bind(null, projectId, reportId), {});
  const configured = status.provider !== null;
  const exhausted = status.usedThisHour >= status.perHour || status.usedToday >= status.perDay;
  return (
    <section className="card border-violet-900/40 bg-violet-950/10 p-5" aria-labelledby="ops-ai-title" data-testid="ops-extract">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ListChecks size={16} className="text-violet-300" aria-hidden />
        <h2 id="ops-ai-title" className="text-sm font-semibold text-violet-200">استخراج الإجراءات والمخاطر بالذكاء الاصطناعي</h2>
        {status.provider === "mock" && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-300">وضع تجريبي: نتائج اختبار</span>}
        {configured && <span className="ms-auto text-[11px] text-slate-400">طلباتك: {status.usedThisHour}/{status.perHour} هذه الساعة</span>}
      </div>
      <p className="mb-3 text-xs text-slate-400">يقترح الإجراءات المطلوبة (مع المسؤول المقترح من أعضاء المشروع) والمشكلات والمخاطر والقرارات من نص التقرير. الإجراء المقبول يصبح مهمة، والمشكلة أو الخطر يُضاف إلى السجل.</p>
      {!configured ? (
        <p role="status" className="text-sm text-slate-400">الذكاء الاصطناعي غير مفعّل على هذا الخادم.</p>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-2">
          {state.code === "duplicate" && (
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" name="force" className="accent-violet-500" /> إعادة الاستخراج رغم التطابق</label>
          )}
          <button className="btn-primary" disabled={pending || exhausted}>{pending ? "جارٍ الاستخراج…" : "استخراج من التقرير"}</button>
          <div className="w-full" aria-live="polite">
            {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
            {state.ok && state.message && <p role="status" className="text-sm text-emerald-400">{state.message}</p>}
          </div>
        </form>
      )}
    </section>
  );
}

/** The project's issues and risks: what is wrong now and what may go wrong, each with an owner and a status. */
export function RiskLog({
  projectId, organizationId, risks, members, reports, canEdit,
}: {
  projectId: string;
  organizationId: string;
  risks: ProjectRiskRow[];
  members: MemberRow[];
  reports: Record<string, string>;
  canEdit: boolean;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const visible = risks.filter((r) => showClosed || r.status !== "closed");
  const open = risks.filter((r) => r.status !== "closed");
  return (
    <section className="card p-5" aria-labelledby="risk-log-title" data-testid="risk-log">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="risk-log-title" className="font-semibold text-white">سجل المشكلات والمخاطر</h2>
        <span className="text-xs text-slate-400">{open.filter((r) => r.kind === "issue").length} مشكلة مفتوحة · {open.filter((r) => r.kind === "risk").length} خطر مفتوح</span>
        <label className="ms-auto flex items-center gap-1 text-xs text-slate-400">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="accent-emerald-500" /> عرض المغلقة
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">لا مشكلات أو مخاطر مفتوحة.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => <RiskItem key={r.id} risk={r} members={members} reportTitle={r.source_report_id ? reports[r.source_report_id] : undefined} projectId={projectId} canEdit={canEdit} />)}
        </ul>
      )}
      {canEdit && <AddRiskForm projectId={projectId} organizationId={organizationId} />}
    </section>
  );
}

const LEVEL_TONE = { high: "bg-red-950 text-red-200", medium: "bg-amber-950 text-amber-200", low: "bg-slate-800 text-slate-300" } as const;

function RiskItem({ risk, members, reportTitle, projectId, canEdit }: { risk: ProjectRiskRow; members: MemberRow[]; reportTitle?: string; projectId: string; canEdit: boolean }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (patch: Parameters<typeof updateRisk>[1]) =>
    start(async () => { setError(null); const r = await updateRisk(risk.id, patch); if (r.error) setError(r.error); });
  return (
    <li className="rounded-lg border border-slate-800 p-3" data-testid="risk">
      <div className="flex flex-wrap items-start gap-2">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">{RISK_KIND_LABEL[risk.kind]}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${LEVEL_TONE[risk.impact]}`}>الأثر: {RISK_LEVEL_LABEL[risk.impact]}</span>
        {risk.likelihood && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">الاحتمال: {RISK_LEVEL_LABEL[risk.likelihood]}</span>}
        <p className="min-w-0 flex-1 text-sm font-medium text-slate-100" dir="auto">{risk.title}</p>
        {canEdit && (
          <button type="button" aria-label={`حذف ${risk.title}`} disabled={busy}
            onClick={() => confirm("حذف من السجل؟") && start(async () => { const r = await deleteRisk(risk.id); if (r.error) setError(r.error); })}
            className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
        )}
      </div>
      {risk.description && <p className="mt-1 text-xs text-slate-400" dir="auto">{risk.description}</p>}
      {risk.mitigation && <p className="mt-1 text-xs text-slate-300">المعالجة: {risk.mitigation}</p>}
      {reportTitle && <a href={`/projects/${projectId}/operations/${risk.source_report_id}`} className="mt-1 inline-block text-[11px] text-emerald-400 hover:underline">المصدر: {reportTitle}</a>}
      {canEdit ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <select aria-label={`حالة ${risk.title}`} value={risk.status} disabled={busy} onChange={(e) => save({ status: e.target.value as ProjectRiskRow["status"] })} className="field py-1 text-xs">
            {(Object.keys(RISK_STATUS_LABEL) as ProjectRiskRow["status"][]).map((s) => <option key={s} value={s}>{RISK_STATUS_LABEL[s]}</option>)}
          </select>
          <select aria-label={`مسؤول ${risk.title}`} value={risk.owner_id ?? ""} disabled={busy} onChange={(e) => save({ owner_id: e.target.value || null })} className="field py-1 text-xs">
            <option value="">بدون مسؤول</option>
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
          </select>
          <select aria-label={`أثر ${risk.title}`} value={risk.impact} disabled={busy} onChange={(e) => save({ impact: e.target.value as ProjectRiskRow["impact"] })} className="field py-1 text-xs">
            {(Object.keys(RISK_LEVEL_LABEL) as ProjectRiskRow["impact"][]).map((l) => <option key={l} value={l}>الأثر: {RISK_LEVEL_LABEL[l]}</option>)}
          </select>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">{RISK_STATUS_LABEL[risk.status]} · {members.find((m) => m.user_id === risk.owner_id)?.email ?? "بدون مسؤول"}</p>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </li>
  );
}

function AddRiskForm({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  const [state, action, pending] = useActionState<OpsState, FormData>(addRisk.bind(null, projectId, organizationId), {});
  return (
    <form action={action} key={state.nonce ?? 0} className="mt-4 grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-[auto_1fr_auto_auto]">
      <label className="sr-only" htmlFor="new-risk-kind">النوع</label>
      <select id="new-risk-kind" name="kind" defaultValue="issue" className="field"><option value="issue">مشكلة</option><option value="risk">خطر</option></select>
      <label className="sr-only" htmlFor="new-risk-title">الوصف</label>
      <input id="new-risk-title" name="title" required maxLength={300} placeholder="مشكلة أو خطر جديد" className="field" />
      <label className="sr-only" htmlFor="new-risk-impact">الأثر</label>
      <select id="new-risk-impact" name="impact" defaultValue="medium" className="field">
        <option value="low">أثر منخفض</option><option value="medium">أثر متوسط</option><option value="high">أثر مرتفع</option>
      </select>
      <button className="btn-primary" disabled={pending}><Plus size={15} /> إضافة</button>
      {state.error && <p role="alert" className="text-sm text-red-400 sm:col-span-4">{state.error}</p>}
    </form>
  );
}
