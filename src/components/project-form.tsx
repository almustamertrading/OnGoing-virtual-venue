"use client";

import { useActionState, useState } from "react";
import { PROJECT_STATUS, PROJECT_TYPE } from "@/lib/format";
import type { ClientRow, ProjectRow, ProjectStatus, ProjectType } from "@/lib/types";
import type { ActionState } from "@/app/projects/actions";

export type ProjectDefaults = {
  name?: string;
  clientName?: string;
  project_type?: ProjectType;
  status?: ProjectStatus;
  location?: string;
  budget?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string;
  reference?: string;
  submission_method?: string;
  submission_location?: string;
  submission_deadline?: string;
  contact?: { name?: string; role?: string; phone?: string; email?: string; address?: string };
};

export type ScopeDraft = { kind: "scope" | "deliverable"; title: string };

export type RfpBlueprintDraft = {
  boq: { description: string; unit: string; quantity: number | null }[];
  plan: { title: string; objective: string; start_date: string | null; end_date: string | null }[];
  team: { title: string; responsibility: string; headcount: number }[];
  evaluation: { criterion: string; weight: number | null }[];
};

type Props = {
  organizationId: string;
  clients: ClientRow[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  project?: ProjectRow;
  defaults?: ProjectDefaults;
  items?: ScopeDraft[];
  blueprint?: RfpBlueprintDraft;
  submitLabel: string;
  onDone?: () => void;
};

export function ProjectForm({ organizationId, clients, action, project, defaults, items, blueprint, submitLabel, onDone }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await action(prev, fd);
    if (result.ok) onDone?.();
    return result;
  }, {});

  const d = defaults ?? {};
  const knownClient = project?.client_id ?? "";
  // When an RFP names a client we don't have yet, open the "new client" field with that name.
  const clientMatch = d.clientName
    ? clients.find((c) => c.name.trim() === d.clientName!.trim())
    : undefined;
  const [newClient, setNewClient] = useState((clients.length === 0) || Boolean(d.clientName && !clientMatch));
  const scope = (items ?? []).filter((i) => i.kind === "scope");
  const deliverables = (items ?? []).filter((i) => i.kind === "deliverable");
  const bp = blueprint;
  const hasBlueprint = Boolean(bp && (bp.boq.length || bp.plan.length || bp.team.length || bp.evaluation.length));
  const fromRfp = Boolean(
    d.reference || d.submission_method || d.submission_location || d.submission_deadline || d.contact || hasBlueprint,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      {items && items.length > 0 && <input type="hidden" name="items_json" value={JSON.stringify(items)} />}
      {hasBlueprint && <input type="hidden" name="blueprint_json" value={JSON.stringify(bp)} />}
      <div>
        <label className="label" htmlFor="p-name">Project name</label>
        <input id="p-name" name="name" required defaultValue={project?.name ?? d.name ?? ""} placeholder="e.g. Riyadh Cup Final 2027" className="field" />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="label mb-0" htmlFor={newClient ? "p-new-client" : "p-client"}>Client</label>
          {clients.length > 0 && (
            <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={() => setNewClient((v) => !v)}>
              {newClient ? "Pick an existing client" : "New client"}
            </button>
          )}
        </div>
        {newClient ? (
          <input id="p-new-client" name="new_client" defaultValue={clientMatch ? "" : d.clientName ?? ""} placeholder="Client company name" className="field" />
        ) : (
          <select id="p-client" name="client_id" defaultValue={clientMatch?.id ?? knownClient} className="field">
            <option value="">No client yet</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="p-type">Type</label>
          <select id="p-type" name="project_type" defaultValue={project?.project_type ?? d.project_type ?? "sports_event"} className="field">
            {Object.entries(PROJECT_TYPE).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-status">Status</label>
          <select id="p-status" name="status" defaultValue={project?.status ?? d.status ?? "lead"} className="field">
            {Object.entries(PROJECT_STATUS).map(([v, s]) => (
              <option key={v} value={v}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="p-start">Starts</label>
          <input id="p-start" name="start_date" type="date" defaultValue={project?.start_date ?? d.start_date ?? ""} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="p-end">Ends</label>
          <input id="p-end" name="end_date" type="date" defaultValue={project?.end_date ?? d.end_date ?? ""} className="field" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="p-location">Location</label>
          <input id="p-location" name="location" defaultValue={project?.location ?? d.location ?? ""} placeholder="City or venue" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="p-budget">Budget (SAR)</label>
          <input id="p-budget" name="budget" inputMode="decimal" defaultValue={project?.budget ?? d.budget ?? ""} placeholder="0" className="field" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="p-description">Summary</label>
        <textarea id="p-description" name="description" rows={3} defaultValue={project?.description ?? d.description ?? ""} className="field" />
      </div>

      {fromRfp && (
        <div dir="rtl" className="space-y-3 rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3">
          <p className="text-xs font-semibold text-emerald-300">من الكراسة — تواصل العميل وتسليم العرض</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="p-contact-name">جهة/مسؤول التواصل</label>
              <input id="p-contact-name" name="client_contact_name" defaultValue={d.contact?.name ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="p-contact-phone">الهاتف</label>
              <input id="p-contact-phone" name="client_phone" dir="ltr" defaultValue={d.contact?.phone ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="p-contact-email">البريد</label>
              <input id="p-contact-email" name="client_email" dir="ltr" defaultValue={d.contact?.email ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="p-contact-address">العنوان</label>
              <input id="p-contact-address" name="client_address" defaultValue={d.contact?.address ?? ""} className="field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="p-ref">رقم الكراسة</label>
              <input id="p-ref" name="rfp_reference" defaultValue={d.reference ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="p-sub-deadline">آخر موعد للتقديم</label>
              <input id="p-sub-deadline" name="submission_deadline" defaultValue={d.submission_deadline ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="p-sub-method">طريقة تقديم العرض</label>
              <input id="p-sub-method" name="submission_method" defaultValue={d.submission_method ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="p-sub-loc">موقع/جهة تسليم العرض</label>
              <input id="p-sub-loc" name="submission_location" defaultValue={d.submission_location ?? ""} className="field" />
            </div>
          </div>
        </div>
      )}

      {(items?.length || hasBlueprint) && (
        <div dir="rtl" className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm">
          <p className="mb-2 text-xs text-slate-400">سيُضاف تلقائيًا من الملف:</p>
          {scope.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-300">نطاق العمل</p>
              <ul className="mb-2 mt-1 list-disc space-y-0.5 pr-5 text-slate-300">
                {scope.map((i, n) => <li key={n}>{i.title}</li>)}
              </ul>
            </>
          )}
          {deliverables.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-300">المخرجات</p>
              <ul className="mb-2 mt-1 list-disc space-y-0.5 pr-5 text-slate-300">
                {deliverables.map((i, n) => <li key={n}>{i.title}</li>)}
              </ul>
            </>
          )}
          {hasBlueprint && bp && (
            <div className="flex flex-wrap gap-2 pt-1">
              {bp.boq.length > 0 && <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-300">جدول كميات: {bp.boq.length}</span>}
              {bp.plan.length > 0 && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300">مراحل الخطة: {bp.plan.length}</span>}
              {bp.team.length > 0 && <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs text-violet-300">أدوار الفريق: {bp.team.length}</span>}
              {bp.evaluation.length > 0 && <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs text-rose-300">معايير تقييم: {bp.evaluation.length}</span>}
            </div>
          )}
        </div>
      )}

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
