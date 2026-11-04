"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { formatDate, isOverdue } from "@/lib/format";
import type { ScopeItemRow } from "@/lib/types";
import type { ActionState } from "../../../actions";
import { addScopeItem, deleteScopeItem, updateScopeItem } from "../work-actions";

const STATUS = { planned: "Planned", in_progress: "In progress", done: "Done" } as const;

export function ScopeList({
  projectId,
  kind,
  items,
  canEdit,
}: {
  projectId: string;
  kind: "scope" | "deliverable";
  items: ScopeItemRow[];
  canEdit: boolean;
}) {
  const [state, action, adding] = useActionState<ActionState, FormData>(addScopeItem.bind(null, projectId, kind), {});
  const [busy, start] = useTransition();
  const noun = kind === "scope" ? "scope item" : "deliverable";

  return (
    <section className="card p-5" data-testid={`scope-${kind}`}>
      <h2 className="font-semibold text-white">{kind === "scope" ? "Scope of work" : "Deliverables"}</h2>
      <p className="mb-4 text-xs text-slate-500">
        {kind === "scope" ? "What the project includes and excludes." : "What you hand to the client, with due dates."}
      </p>
      {items.length === 0 && <p className="mb-4 text-sm text-slate-500">No {noun}s yet.</p>}
      <ul className="mb-4 divide-y divide-slate-800">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${it.status === "done" ? "text-slate-500 line-through" : "text-slate-100"}`}>{it.title}</p>
              {it.description && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-400">{it.description}</p>}
              {it.due_date && (
                <p className={`mt-0.5 text-xs ${isOverdue(it.due_date, it.status === "done") ? "text-red-300" : "text-slate-500"}`}>
                  Due {formatDate(it.due_date)}
                </p>
              )}
            </div>
            {canEdit ? (
              <>
                <select
                  aria-label={`Status of ${it.title}`}
                  value={it.status}
                  disabled={busy}
                  onChange={(e) => start(() => updateScopeItem(it.id, { status: e.target.value as ScopeItemRow["status"] }))}
                  className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
                >
                  {Object.entries(STATUS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Delete ${it.title}`}
                  disabled={busy}
                  onClick={() => confirm(`Delete “${it.title}”?`) && start(() => deleteScopeItem(it.id))}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-400">{STATUS[it.status]}</span>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form action={action} className="space-y-2 border-t border-slate-800 pt-4" key={items.length}>
          <input name="title" required placeholder={`Add a ${noun}`} aria-label={`New ${noun}`} className="field" />
          <textarea name="description" rows={2} placeholder="Details (optional)" aria-label="Details" className="field" />
          <div className="flex gap-2">
            <input name="due_date" type="date" aria-label="Due date" className="field" />
            <button className="btn-primary shrink-0" disabled={adding}>{adding ? "Adding…" : "Add"}</button>
          </div>
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
