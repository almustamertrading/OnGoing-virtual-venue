"use client";

import { useActionState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import type { MemberRole, MemberRow } from "@/lib/types";
import { addMember, removeMember, updateMember, type ActionState } from "../../../actions";

const ROLE_HELP: Record<MemberRole, string> = {
  owner: "Full control, including team and deletion",
  editor: "Can change tasks, scope, venues and files",
  viewer: "Can view, comment and update tasks assigned to them",
};

export function MembersPanel({
  projectId,
  members,
  isOwner,
  currentUserId,
}: {
  projectId: string;
  members: MemberRow[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addMember.bind(null, projectId), {});
  const [busy, start] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="card p-5" data-testid="team">
        <h2 className="mb-4 font-semibold text-white">Team and responsibilities</h2>
        <ul className="divide-y divide-slate-800">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-100">
                  {m.email}
                  {m.user_id === currentUserId && <span className="text-slate-500"> (you)</span>}
                </p>
                {isOwner ? (
                  <input
                    aria-label={`Responsibility of ${m.email}`}
                    defaultValue={m.responsibility}
                    placeholder="Responsibility, e.g. Venue operations lead"
                    onBlur={(e) =>
                      e.target.value !== m.responsibility &&
                      start(() => updateMember(projectId, m.user_id, { responsibility: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-transparent bg-transparent px-0 py-0.5 text-xs text-slate-400 hover:border-slate-700 focus:border-emerald-600 focus:px-1.5 focus:outline-none"
                  />
                ) : (
                  <p className="text-xs text-slate-400">{m.responsibility || "No responsibility set"}</p>
                )}
              </div>
              {isOwner && m.user_id !== currentUserId ? (
                <>
                  <select
                    aria-label={`Role of ${m.email}`}
                    defaultValue={m.role}
                    disabled={busy}
                    onChange={(e) => start(() => updateMember(projectId, m.user_id, { role: e.target.value as MemberRole }))}
                    className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
                  >
                    <option value="owner">Owner</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="button"
                    aria-label={`Remove ${m.email}`}
                    disabled={busy}
                    onClick={() => confirm(`Remove ${m.email} from this project?`) && start(() => removeMember(projectId, m.user_id))}
                    className="text-slate-500 hover:text-red-400"
                  >
                    <UserMinus size={16} />
                  </button>
                </>
              ) : (
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs capitalize text-slate-300">{m.role}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <form action={action} className="card space-y-3 p-5" key={members.length}>
          <h2 className="font-semibold text-white">Add a teammate</h2>
          <div>
            <label className="label" htmlFor="member-email">Email</label>
            <input id="member-email" name="email" type="email" required placeholder="their account email" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="member-role">Role</label>
            <select id="member-role" name="role" defaultValue="editor" className="field">
              {(Object.keys(ROLE_HELP) as MemberRole[]).map((r) => (
                <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}: {ROLE_HELP[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="member-resp">Responsibility</label>
            <input id="member-resp" name="responsibility" placeholder="e.g. Hospitality and VIP" className="field" />
          </div>
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          {state.ok && <p className="text-sm text-emerald-400">Added.</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending ? "Adding…" : "Add to project"}</button>
          <p className="text-xs text-slate-500">People need an account first. Colleagues with an ongoingevent.com email join the company automatically when they sign up.</p>
        </form>
      )}
    </div>
  );
}
