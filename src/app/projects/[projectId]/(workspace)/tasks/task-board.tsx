"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { TASK_PRIORITY, TASK_STATUS, formatDate, isOverdue } from "@/lib/format";
import type { MemberRow, MilestoneRow, ScopeItemRow, TaskPriority, TaskRow, TaskStatus } from "@/lib/types";
import type { ActionState } from "../../../actions";
import { addTask, deleteTask, updateTask, type TaskPatch } from "../work-actions";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

export function TaskBoard({
  projectId,
  tasks,
  members,
  milestones,
  scopeItems,
  userId,
  canEdit,
  initialMine,
}: {
  projectId: string;
  tasks: TaskRow[];
  members: MemberRow[];
  milestones: MilestoneRow[];
  scopeItems: ScopeItemRow[];
  userId: string;
  canEdit: boolean;
  initialMine: boolean;
}) {
  const [mine, setMine] = useState(initialMine);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [state, addAction, saving] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await addTask(projectId, prev, fd);
    if (r.ok) setAdding(false);
    return r;
  }, {});

  const people = useMemo(() => new Map(members.map((m) => [m.user_id, m.email])), [members]);
  const milestoneName = useMemo(() => new Map(milestones.map((m) => [m.id, m.title])), [milestones]);
  const shown = mine ? tasks.filter((t) => t.assignee_id === userId) : tasks;

  const patch = (id: string, p: TaskPatch) =>
    start(async () => {
      setError(null);
      try {
        await updateTask(id, p);
      } catch (e) {
        setError((e as Error).message);
      }
    });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-slate-900 p-1 text-sm">
          {[false, true].map((m) => (
            <button
              key={String(m)}
              type="button"
              onClick={() => setMine(m)}
              className={`rounded-md px-3 py-1 ${mine === m ? "bg-slate-700 text-slate-100" : "text-slate-400"}`}
            >
              {m ? "Mine" : "All tasks"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {canEdit && !adding && (
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> New task
          </button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {adding && (
        <form action={addAction} className="card grid gap-3 p-4 sm:grid-cols-2" data-testid="new-task">
          <div className="sm:col-span-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-100">New task</h3>
            <button type="button" aria-label="Close" onClick={() => setAdding(false)} className="text-slate-400 hover:text-slate-100"><X size={16} /></button>
          </div>
          <input name="title" required autoFocus placeholder="What needs doing?" aria-label="Task title" className="field sm:col-span-2" />
          <textarea name="description" rows={2} placeholder="Details (optional)" aria-label="Task details" className="field sm:col-span-2" />
          <select name="assignee_id" aria-label="Assignee" className="field" defaultValue="">
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
          </select>
          <input name="due_date" type="date" aria-label="Due date" className="field" />
          <select name="priority" aria-label="Priority" className="field" defaultValue="normal">
            {Object.entries(TASK_PRIORITY).map(([v, p]) => <option key={v} value={v}>{p.label} priority</option>)}
          </select>
          <select name="milestone_id" aria-label="Milestone" className="field" defaultValue="">
            <option value="">No milestone</option>
            {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
          <select name="scope_item_id" aria-label="Scope item" className="field sm:col-span-2" defaultValue="">
            <option value="">Not linked to a scope item</option>
            {scopeItems.map((s) => <option key={s.id} value={s.id}>{s.kind === "deliverable" ? "Deliverable: " : "Scope: "}{s.title}</option>)}
          </select>
          {state.error && <p className="text-sm text-red-400 sm:col-span-2">{state.error}</p>}
          <button className="btn-primary sm:col-span-2" disabled={saving}>{saving ? "Adding…" : "Add task"}</button>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = shown.filter((t) => t.status === col);
          return (
            <div key={col} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3" data-testid={`column-${col}`}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {TASK_STATUS[col]} <span className="text-slate-600">{list.length}</span>
              </h3>
              <ul className="space-y-2">
                {list.map((t) => {
                  const mayChange = canEdit || t.assignee_id === userId;
                  const overdue = isOverdue(t.due_date, t.status === "done");
                  const open = openId === t.id;
                  return (
                    <li key={t.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm" data-testid="task-card">
                      <button type="button" className="block w-full text-left" onClick={() => setOpenId(open ? null : t.id)}>
                        <p className={t.status === "done" ? "text-slate-500 line-through" : "text-slate-100"}>{t.title}</p>
                        <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
                          {t.assignee_id ? <span>{(people.get(t.assignee_id) ?? "Someone").split("@")[0]}</span> : <span>Unassigned</span>}
                          {t.due_date && <span className={overdue ? "text-red-300" : ""}>Due {formatDate(t.due_date)}</span>}
                          {t.priority !== "normal" && <span className={TASK_PRIORITY[t.priority].tone}>{TASK_PRIORITY[t.priority].label}</span>}
                          {t.milestone_id && <span>· {milestoneName.get(t.milestone_id)}</span>}
                        </p>
                      </button>
                      {mayChange && (
                        <select
                          aria-label={`Status of ${t.title}`}
                          value={t.status}
                          disabled={busy}
                          onChange={(e) => patch(t.id, { status: e.target.value as TaskStatus })}
                          className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
                        >
                          {COLUMNS.map((c) => <option key={c} value={c}>{TASK_STATUS[c]}</option>)}
                        </select>
                      )}
                      {open && (
                        <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                          {t.description && <p className="whitespace-pre-wrap text-xs text-slate-300">{t.description}</p>}
                          {canEdit && (
                            <>
                              <select
                                aria-label="Reassign"
                                value={t.assignee_id ?? ""}
                                onChange={(e) => patch(t.id, { assignee_id: e.target.value || null })}
                                className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
                              >
                                <option value="">Unassigned</option>
                                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
                              </select>
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  aria-label="Change due date"
                                  defaultValue={t.due_date ?? ""}
                                  onBlur={(e) => e.target.value !== (t.due_date ?? "") && patch(t.id, { due_date: e.target.value || null })}
                                  className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
                                />
                                <select
                                  aria-label="Change priority"
                                  value={t.priority}
                                  onChange={(e) => patch(t.id, { priority: e.target.value as TaskPriority })}
                                  className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
                                >
                                  {Object.entries(TASK_PRIORITY).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => confirm(`Delete “${t.title}”?`) && start(() => deleteTask(t.id))}
                                className="flex items-center gap-1 text-xs text-red-300 hover:underline"
                              >
                                <Trash2 size={12} /> Delete task
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
