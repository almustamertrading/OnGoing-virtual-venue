"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { formatDate, isOverdue } from "@/lib/format";
import type { MilestoneRow } from "@/lib/types";
import type { ActionState } from "../../../actions";
import { addMilestone, deleteMilestone, updateMilestone } from "../work-actions";

export function MilestonesPanel({
  projectId,
  milestones,
  taskCounts,
  canEdit,
}: {
  projectId: string;
  milestones: MilestoneRow[];
  taskCounts: Record<string, { open: number; total: number }>;
  canEdit: boolean;
}) {
  const [state, action, adding] = useActionState<ActionState, FormData>(addMilestone.bind(null, projectId), {});
  const [busy, start] = useTransition();

  return (
    <section className="card p-5" data-testid="milestones">
      <h2 className="mb-3 font-semibold text-white">Milestones</h2>
      {milestones.length === 0 && <p className="mb-3 text-sm text-slate-500">No milestones yet.</p>}
      <ul className="space-y-2">
        {milestones.map((m) => {
          const c = taskCounts[m.id] ?? { open: 0, total: 0 };
          return (
            <li key={m.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`Mark ${m.title} done`}
                checked={m.done}
                disabled={!canEdit || busy}
                onChange={(e) => start(() => updateMilestone(m.id, { done: e.target.checked }))}
                className="mt-1 accent-emerald-500"
              />
              <div className="min-w-0 flex-1">
                <p className={m.done ? "text-slate-500 line-through" : "text-slate-100"}>{m.title}</p>
                <p className="text-xs text-slate-500">
                  <span className={isOverdue(m.due_date, m.done) ? "text-red-300" : ""}>
                    {m.due_date ? formatDate(m.due_date) : "No date"}
                  </span>
                  {c.total > 0 && ` · ${c.total - c.open} of ${c.total} tasks done`}
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Delete ${m.title}`}
                  onClick={() => confirm(`Delete milestone “${m.title}”? Its tasks stay.`) && start(() => deleteMilestone(m.id))}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <form action={action} className="mt-4 space-y-2 border-t border-slate-800 pt-4" key={milestones.length}>
          <input name="title" required placeholder="New milestone" aria-label="New milestone" className="field" />
          <div className="flex gap-2">
            <input name="due_date" type="date" aria-label="Milestone date" className="field" />
            <button className="btn-ghost shrink-0" disabled={adding}>Add</button>
          </div>
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
