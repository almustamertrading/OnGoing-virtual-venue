"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, LayoutTemplate, Pencil, Plus, Trash2, X } from "lucide-react";
import { PROPOSAL_TYPE, SECTION_TEMPLATES } from "@/lib/proposal-meta";
import { TEMPLATE_LIMITS } from "@/lib/proposal-templates";
import type { ProposalTemplateRow, ProposalTemplateSection, ProposalType } from "@/lib/types";
import { deleteTemplate, saveTemplate, type TemplateState } from "./actions";

export function TemplatesManager({ templates, canEdit }: { templates: ProposalTemplateRow[]; canEdit: boolean }) {
  // null: no editor open; "new": creating; otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const current = editing && editing !== "new" ? templates.find((t) => t.id === editing) ?? null : null;

  const remove = (t: ProposalTemplateRow) => {
    if (!confirm(`حذف القالب «${t.name}»؟ العروض التي أُنشئت منه تبقى كما هي.`)) return;
    start(async () => {
      setError(null);
      const r = await deleteTemplate(t.id);
      if (r.error) setError(r.error);
      else setNotice(r.message ?? null);
    });
  };

  return (
    <div className="space-y-4">
      {canEdit && editing === null && (
        <button type="button" className="btn-primary" onClick={() => { setNotice(null); setEditing("new"); }}>
          <Plus size={16} /> قالب جديد
        </button>
      )}
      <div aria-live="polite">
        {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </div>

      {editing !== null && (
        <TemplateEditor
          key={editing}
          template={current}
          onDone={(message) => { setEditing(null); setNotice(message); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {templates.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-400">
          <LayoutTemplate className="mx-auto mb-2 text-slate-500" size={28} />
          لا توجد قوالب بعد.{canEdit ? " أنشئ قالبًا لتوحيد هيكل عروض فريقك." : ""}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="القوالب">
          {templates.map((t) => (
            <li key={t.id} className="card p-4" data-testid="template-card">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-white">{t.name}</h2>
                  <p className="text-xs text-slate-400">{PROPOSAL_TYPE[t.proposal_type].label} · {t.sections.length} قسمًا</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button type="button" aria-label={`تعديل ${t.name}`} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => { setNotice(null); setEditing(t.id); }}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" aria-label={`حذف ${t.name}`} disabled={busy} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400" onClick={() => remove(t)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              {t.description && <p className="mt-2 text-sm text-slate-300">{t.description}</p>}
              <ol className="mt-3 list-decimal space-y-0.5 pr-5 text-xs text-slate-400">
                {t.sections.slice(0, 6).map((s) => <li key={s.heading}>{s.heading}</li>)}
                {t.sections.length > 6 && <li className="list-none text-slate-500">و{t.sections.length - 6} أقسام أخرى…</li>}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TemplateEditor({
  template, onDone, onCancel,
}: {
  template: ProposalTemplateRow | null;
  onDone: (message: string | null) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<TemplateState, FormData>(saveTemplate.bind(null, template?.id ?? null), {});
  const [type, setType] = useState<ProposalType>(template?.proposal_type ?? "technical_financial");
  const [rows, setRows] = useState<ProposalTemplateSection[]>(
    template?.sections.length ? template.sections : SECTION_TEMPLATES[template?.proposal_type ?? "technical_financial"].map((heading) => ({ heading, guidance: "" })),
  );

  useEffect(() => {
    if (state.ok) onDone(state.message ?? null);
  }, [state, onDone]);

  const update = (i: number, patch: Partial<ProposalTemplateSection>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const move = (i: number, by: -1 | 1) =>
    setRows((r) => {
      const j = i + by;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <form action={action} className="card space-y-4 p-5" aria-label={template ? `تعديل القالب ${template.name}` : "قالب جديد"}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white">{template ? "تعديل القالب" : "قالب جديد"}</h2>
        <button type="button" onClick={onCancel} aria-label="إغلاق" className="text-slate-400 hover:text-white"><X size={18} /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="tpl-name">اسم القالب</label>
          <input id="tpl-name" name="name" required maxLength={TEMPLATE_LIMITS.name} defaultValue={template?.name ?? ""} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="tpl-type">نوع العرض</label>
          <select id="tpl-type" name="proposal_type" value={type} onChange={(e) => setType(e.target.value as ProposalType)} className="field">
            {Object.entries(PROPOSAL_TYPE).map(([v, t]) => <option key={v} value={v}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="tpl-desc">وصف مختصر (اختياري)</label>
        <textarea id="tpl-desc" name="description" rows={2} maxLength={TEMPLATE_LIMITS.description} defaultValue={template?.description ?? ""} className="field" />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-2 text-sm font-medium text-slate-200">
          الأقسام ({rows.length}/{TEMPLATE_LIMITS.sections})
          <button
            type="button"
            className="text-xs text-emerald-400 hover:underline"
            onClick={() => confirm("استبدال الأقسام بالأقسام الافتراضية لهذا النوع؟") && setRows(SECTION_TEMPLATES[type].map((heading) => ({ heading, guidance: "" })))}
          >
            الأقسام الافتراضية للنوع
          </button>
        </legend>
        {rows.map((row, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-slate-800 p-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <input
              aria-label={`عنوان القسم ${i + 1}`}
              value={row.heading}
              maxLength={TEMPLATE_LIMITS.heading}
              onChange={(e) => update(i, { heading: e.target.value })}
              placeholder="عنوان القسم"
              className="field"
            />
            <input
              aria-label={`توجيه القسم ${i + 1}`}
              value={row.guidance}
              maxLength={TEMPLATE_LIMITS.guidance}
              onChange={(e) => update(i, { guidance: e.target.value })}
              placeholder="توجيه للكاتب أو للذكاء الاصطناعي (اختياري)"
              className="field"
            />
            <div className="flex items-center gap-1">
              <button type="button" aria-label={`نقل القسم ${i + 1} لأعلى`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp size={14} /></button>
              <button type="button" aria-label={`نقل القسم ${i + 1} لأسفل`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown size={14} /></button>
              <button type="button" aria-label={`حذف القسم ${i + 1}`} onClick={() => setRows((r) => r.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-ghost"
          disabled={rows.length >= TEMPLATE_LIMITS.sections}
          onClick={() => setRows((r) => [...r, { heading: "", guidance: "" }])}
        >
          <Plus size={15} /> إضافة قسم
        </button>
      </fieldset>

      <input type="hidden" name="sections_json" value={JSON.stringify(rows)} />
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "جارٍ الحفظ…" : "حفظ القالب"}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>إلغاء</button>
      </div>
    </form>
  );
}
