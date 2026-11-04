"use client";

import { useActionState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import type { MemberRole } from "@/lib/types";
import { addMember, removeMember, updateMemberRole, type ActionState } from "../actions";

type Member = { user_id: string; role: MemberRole; email: string };

export function MembersPanel({
  eventId,
  members,
  isOwner,
  currentUserId,
}: {
  eventId: string;
  members: Member[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addMember.bind(null, eventId),
    {},
  );
  const [busy, startTransition] = useTransition();

  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-semibold text-white">Team</h2>
      <ul className="space-y-2 text-sm">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-slate-200">
              {m.email}
              {m.user_id === currentUserId && <span className="text-slate-500"> (you)</span>}
            </span>
            {isOwner && m.user_id !== currentUserId ? (
              <>
                <select
                  aria-label={`Role for ${m.email}`}
                  defaultValue={m.role}
                  disabled={busy}
                  onChange={(e) =>
                    startTransition(() =>
                      updateMemberRole(eventId, m.user_id, e.target.value as MemberRole),
                    )
                  }
                  className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs"
                >
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="button"
                  aria-label={`Remove ${m.email}`}
                  disabled={busy}
                  onClick={() => startTransition(() => removeMember(eventId, m.user_id))}
                  className="text-slate-500 hover:text-red-400"
                >
                  <UserMinus size={16} />
                </button>
              </>
            ) : (
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs capitalize text-slate-300">
                {m.role}
              </span>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form action={action} className="space-y-2 border-t border-slate-800 pt-4">
          <label className="label" htmlFor="member-email">Add a teammate</label>
          <input
            id="member-email"
            name="email"
            type="email"
            required
            placeholder="their account email"
            className="field"
          />
          <div className="flex gap-2">
            <select name="role" defaultValue="editor" className="field">
              <option value="editor">Editor: can draw and edit</option>
              <option value="viewer">Viewer: can view and comment</option>
              <option value="owner">Owner: full control</option>
            </select>
            <button className="btn-primary" disabled={pending}>Add</button>
          </div>
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          {state.ok && <p className="text-sm text-emerald-400">Added.</p>}
          <p className="text-xs text-slate-500">They need to create an account first.</p>
        </form>
      )}
    </section>
  );
}
