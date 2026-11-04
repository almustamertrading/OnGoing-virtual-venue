"use client";

import { useActionState, useState } from "react";
import { PROJECT_STATUS, PROJECT_TYPE } from "@/lib/format";
import type { ClientRow, ProjectRow } from "@/lib/types";
import type { ActionState } from "@/app/projects/actions";

type Props = {
  organizationId: string;
  clients: ClientRow[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  project?: ProjectRow;
  submitLabel: string;
  onDone?: () => void;
};

export function ProjectForm({ organizationId, clients, action, project, submitLabel, onDone }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await action(prev, fd);
    if (result.ok) onDone?.();
    return result;
  }, {});
  const [newClient, setNewClient] = useState(clients.length === 0);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <div>
        <label className="label" htmlFor="p-name">Project name</label>
        <input id="p-name" name="name" required defaultValue={project?.name} placeholder="e.g. Riyadh Cup Final 2027" className="field" />
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
          <input id="p-new-client" name="new_client" placeholder="Client company name" className="field" />
        ) : (
          <select id="p-client" name="client_id" defaultValue={project?.client_id ?? ""} className="field">
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
          <select id="p-type" name="project_type" defaultValue={project?.project_type ?? "sports_event"} className="field">
            {Object.entries(PROJECT_TYPE).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-status">Status</label>
          <select id="p-status" name="status" defaultValue={project?.status ?? "lead"} className="field">
            {Object.entries(PROJECT_STATUS).map(([v, s]) => (
              <option key={v} value={v}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="p-start">Starts</label>
          <input id="p-start" name="start_date" type="date" defaultValue={project?.start_date ?? ""} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="p-end">Ends</label>
          <input id="p-end" name="end_date" type="date" defaultValue={project?.end_date ?? ""} className="field" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="p-location">Location</label>
          <input id="p-location" name="location" defaultValue={project?.location ?? ""} placeholder="City or venue" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="p-budget">Budget (SAR)</label>
          <input id="p-budget" name="budget" inputMode="decimal" defaultValue={project?.budget ?? ""} placeholder="0" className="field" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="p-description">Summary</label>
        <textarea id="p-description" name="description" rows={3} defaultValue={project?.description ?? ""} className="field" />
      </div>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
