"use client";

import { useState } from "react";
import { CheckCircle2, CircleDot, MessageSquarePlus, Trash2 } from "lucide-react";
import type { CommentRow } from "@/lib/types";
import { colorForUser, timeAgo } from "./utils";
import type { VenueData } from "./use-venue-data";

export function CommentsPanel({
  data,
  userId,
  canEdit,
  activeId,
  onOpen,
}: {
  data: VenueData;
  userId: string;
  canEdit: boolean;
  activeId: string | null;
  onOpen: (c: CommentRow) => void;
}) {
  const [showResolved, setShowResolved] = useState(false);
  const threads = data.comments.filter((c) => !c.parent_id);
  const open = threads.filter((c) => !c.resolved);
  const resolved = threads.filter((c) => c.resolved);
  const list = showResolved ? [...open, ...resolved] : open;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <MessageSquarePlus size={14} /> Pick the comment tool, then tap the map to pin a note.
      </p>
      {list.length === 0 && <p className="text-sm text-slate-500">No open comments.</p>}
      <ul className="space-y-2">
        {list.map((c) => (
          <Thread
            key={c.id}
            comment={c}
            replies={data.comments.filter((r) => r.parent_id === c.id)}
            data={data}
            userId={userId}
            canEdit={canEdit}
            active={c.id === activeId}
            onOpen={() => onOpen(c)}
          />
        ))}
      </ul>
      {resolved.length > 0 && (
        <button type="button" className="text-xs text-slate-400 underline" onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? "Hide" : "Show"} {resolved.length} resolved
        </button>
      )}
    </div>
  );
}

function Author({ id, data, at }: { id: string; data: VenueData; at: string }) {
  const email = data.profiles[id]?.email ?? "Someone";
  return (
    <p className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className="h-2 w-2 rounded-full" style={{ background: colorForUser(id) }} />
      <span className="font-medium text-slate-200">{email.split("@")[0]}</span>
      <span>{timeAgo(at)}</span>
    </p>
  );
}

function Thread({
  comment,
  replies,
  data,
  userId,
  canEdit,
  active,
  onOpen,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  data: VenueData;
  userId: string;
  canEdit: boolean;
  active: boolean;
  onOpen: () => void;
}) {
  const [reply, setReply] = useState("");
  const canManage = canEdit || comment.created_by === userId;

  return (
    <li
      className={`rounded-lg border p-2.5 ${active ? "border-emerald-600 bg-emerald-950/20" : "border-slate-800 bg-slate-900"} ${comment.resolved ? "opacity-70" : ""}`}
      data-testid="comment-thread"
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <Author id={comment.created_by} data={data} at={comment.created_at} />
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{comment.body}</p>
        {!active && replies.length > 0 && (
          <p className="mt-1 text-xs text-emerald-400">{replies.length} repl{replies.length === 1 ? "y" : "ies"}</p>
        )}
      </button>
      {active && (
        <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
          {replies.map((r) => (
            <div key={r.id} className="group">
              <div className="flex items-start justify-between gap-2">
                <Author id={r.created_by} data={data} at={r.created_at} />
                {(canEdit || r.created_by === userId) && (
                  <button
                    type="button"
                    onClick={() => data.deleteComment(r.id)}
                    className="text-slate-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Delete reply"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{r.body}</p>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!reply.trim()) return;
              const ok = await data.addComment({ body: reply.trim(), parentId: comment.id });
              if (ok) setReply("");
            }}
            className="flex gap-1.5"
          >
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" className="field py-1.5 text-xs" />
            <button className="btn-primary px-2 py-1 text-xs" disabled={!reply.trim()}>Send</button>
          </form>
          {canManage && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost flex-1 py-1 text-xs"
                onClick={() => data.setCommentResolved(comment.id, !comment.resolved)}
              >
                {comment.resolved ? <CircleDot size={13} /> : <CheckCircle2 size={13} />}
                {comment.resolved ? "Reopen" : "Resolve"}
              </button>
              <button
                type="button"
                className="btn-danger py-1 text-xs"
                onClick={() => confirm("Delete this comment and its replies?") && data.deleteComment(comment.id)}
                aria-label="Delete comment"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
