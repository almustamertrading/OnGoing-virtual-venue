"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { CATEGORY_LABEL, complianceSummary, REQUIREMENT_CATEGORIES, STATUS_LABEL } from "@/lib/tender";
import type { MemberRow, ProjectRequirementRow, RequirementCategory, RequirementStatus } from "@/lib/types";
import { addRequirement, deleteRequirement, updateRequirement, type RegisterState, type RequirementPatch } from "./actions";

type Filter = "all" | "open" | "missing" | "met";
const STATUSES = Object.keys(STATUS_LABEL) as RequirementStatus[];

export function RequirementsRegister({
  projectId, organizationId, rows, members, documents, canEdit, today,
}: {
  projectId: string;
  organizationId: string;
  rows: ProjectRequirementRow[];
  members: MemberRow[];
  documents: { id: string; title: string }[];
  canEdit: boolean;
  today: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<RequirementCategory | "all">("all");
  const summary = complianceSummary(rows, today);
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (category !== "all" && r.category !== category) return false;
        if (filter === "open") return r.status === "open" || r.status === "in_progress";
        if (filter === "missing") return r.status !== "not_applicable" && !r.document_id;
        if (filter === "met") return r.status === "met";
        return true;
      }),
    [rows, filter, category],
  );

  return (
    <section className="card p-5" aria-labelledby="register-title" data-testid="requirements-register">
      <h2 id="register-title" className="mb-3 font-semibold text-white">سجل متطلبات العطاء</h2>

      <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="compliance-summary">
        <Stat label="المتطلبات الإلزامية المستوفاة" value={`${summary.mandatoryMet}/${summary.mandatory}`} hint={`${summary.percent}%`} tone="text-emerald-300" />
        <Stat label="بلا مستند داعم" value={String(summary.missingEvidence)} tone={summary.missingEvidence ? "text-amber-300" : "text-white"} />
        <Stat label="متأخرة" value={String(summary.overdue)} tone={summary.overdue ? "text-red-300" : "text-white"} />
        <Stat label="إجمالي المتطلبات" value={String(summary.total)} />
      </dl>

      <div className="mb-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="req-filter">تصفية حسب الحالة</label>
        <select id="req-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="field w-44">
          <option value="all">كل المتطلبات</option>
          <option value="open">غير مستوفاة</option>
          <option value="missing">بلا مستند داعم</option>
          <option value="met">مستوفاة</option>
        </select>
        <label className="sr-only" htmlFor="req-category">تصفية حسب الفئة</label>
        <select id="req-category" value={category} onChange={(e) => setCategory(e.target.value as RequirementCategory | "all")} className="field w-40">
          <option value="all">كل الفئات</option>
          {REQUIREMENT_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          السجل فارغ. حلّل ملف الكراسة بالذكاء الاصطناعي واقبل النتائج، أو أضف المتطلبات يدويًا.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-400">لا متطلبات تطابق التصفية.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <RequirementItem key={r.id} row={r} members={members} documents={documents} canEdit={canEdit} today={today} />
          ))}
        </ul>
      )}

      {canEdit && <AddRequirementForm projectId={projectId} organizationId={organizationId} />}
    </section>
  );
}

function Stat({ label, value, hint, tone = "text-white" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 text-lg font-bold ${tone}`}>{value}{hint && <span className="ms-1 text-xs font-normal text-slate-400">{hint}</span>}</dd>
    </div>
  );
}

function RequirementItem({
  row, members, documents, canEdit, today,
}: {
  row: ProjectRequirementRow;
  members: MemberRow[];
  documents: { id: string; title: string }[];
  canEdit: boolean;
  today: string;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (patch: RequirementPatch) =>
    start(async () => {
      setError(null);
      const r = await updateRequirement(row.id, patch);
      if (r.error) setError(r.error);
    });
  const overdue = row.status !== "met" && row.status !== "not_applicable" && row.due_date !== null && row.due_date < today;
  const missing = row.status !== "not_applicable" && !row.document_id;
  const doc = documents.find((d) => d.id === row.document_id);
  const owner = members.find((m) => m.user_id === row.owner_id);

  return (
    <li id={`req-${row.id}`} className="rounded-lg border border-slate-800 p-3" data-testid="requirement">
      <div className="flex flex-wrap items-start gap-2">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">{CATEGORY_LABEL[row.category]}</span>
        {row.mandatory && <span className="rounded bg-sky-950 px-1.5 py-0.5 text-[11px] text-sky-200">إلزامي</span>}
        {row.finding_id && <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[11px] text-violet-300"><Sparkles size={11} aria-hidden /> من التحليل</span>}
        <p className="min-w-0 flex-1 text-sm font-medium text-slate-100" dir="auto">{row.title}</p>
        {canEdit && (
          <button type="button" aria-label={`حذف ${row.title}`} disabled={busy}
            onClick={() => confirm("حذف المتطلب من السجل؟") && start(async () => { const r = await deleteRequirement(row.id); if (r.error) setError(r.error); })}
            className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
        )}
      </div>
      {row.details && <p className="mt-1 text-xs text-slate-400" dir="auto">{row.details}</p>}
      {row.source_ref && <p className="mt-1 text-[11px] text-slate-500">المصدر: {row.source_ref}</p>}

      {canEdit ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Field label="الحالة">
            <select value={row.status} disabled={busy} onChange={(e) => save({ status: e.target.value as RequirementStatus })} className="field py-1 text-xs" aria-label={`حالة ${row.title}`}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="المسؤول">
            <select value={row.owner_id ?? ""} disabled={busy} onChange={(e) => save({ owner_id: e.target.value || null })} className="field py-1 text-xs" aria-label={`مسؤول ${row.title}`}>
              <option value="">بدون مسؤول</option>
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
            </select>
          </Field>
          <Field label="الموعد">
            <input type="date" defaultValue={row.due_date ?? ""} disabled={busy} aria-label={`موعد ${row.title}`}
              onBlur={(e) => e.target.value !== (row.due_date ?? "") && save({ due_date: e.target.value || null })} className="field py-1 text-xs" />
          </Field>
          <Field label="المستند الداعم">
            <select value={row.document_id ?? ""} disabled={busy} onChange={(e) => save({ document_id: e.target.value || null })} className="field py-1 text-xs" aria-label={`مستند ${row.title}`}>
              <option value="">لا يوجد بعد</option>
              {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </Field>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">
          {STATUS_LABEL[row.status]} · {owner?.email ?? "بدون مسؤول"} · {row.due_date ? <bdi>{row.due_date}</bdi> : "بدون موعد"} · {doc?.title ?? "بلا مستند داعم"}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        {missing && <span className="text-amber-300">بلا مستند داعم</span>}
        {overdue && <span className="text-red-300">تجاوز الموعد</span>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function AddRequirementForm({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(addRequirement.bind(null, projectId, organizationId), {});
  return (
    <form action={action} key={state.nonce ?? 0} className="mt-4 grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-[1fr_auto_auto_auto_auto]">
      <label className="sr-only" htmlFor="new-req-title">متطلب جديد</label>
      <input id="new-req-title" name="title" required maxLength={300} placeholder="متطلب جديد (مثال: شهادة الزكاة سارية)" className="field" />
      <label className="sr-only" htmlFor="new-req-category">الفئة</label>
      <select id="new-req-category" name="category" defaultValue="document" className="field">
        {REQUIREMENT_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
      </select>
      <label className="sr-only" htmlFor="new-req-due">الموعد</label>
      <input id="new-req-due" name="due_date" type="date" className="field" />
      <label className="flex items-center gap-1 text-xs text-slate-300"><input type="checkbox" name="mandatory" defaultChecked className="accent-emerald-500" /> إلزامي</label>
      <button className="btn-primary" disabled={pending}><Plus size={15} /> إضافة</button>
      {state.error && <p role="alert" className="text-sm text-red-400 sm:col-span-5">{state.error}</p>}
    </form>
  );
}
