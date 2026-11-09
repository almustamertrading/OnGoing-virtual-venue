"use client";

import Link from "next/link";
import { useActionState } from "react";
import { History, MessageSquare, Save } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { PROPOSAL_STATUS } from "@/lib/proposal-meta";
import { REVIEW_DECISION, reviewedVersion } from "@/lib/proposal-workflow";
import type { ProposalReviewRow, ProposalRow, ProposalVersionRow } from "@/lib/types";
import { reviewProposal, saveVersion, type ActionState } from "../actions";

type Entry =
  | { kind: "version"; at: string; row: ProposalVersionRow }
  | { kind: "review"; at: string; row: ProposalReviewRow };

/** Version history and the review discussion, newest first. */
export function HistoryPanel({
  proposal, versions, reviews, people, canComment, canSaveVersion,
}: {
  proposal: ProposalRow;
  versions: ProposalVersionRow[];
  reviews: ProposalReviewRow[];
  people: Record<string, string>;
  canComment: boolean;
  canSaveVersion: boolean;
}) {
  const entries: Entry[] = [
    ...versions.map((row) => ({ kind: "version" as const, at: row.created_at, row })),
    ...reviews.map((row) => ({ kind: "review" as const, at: row.created_at, row })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const who = (id: string | null) => (id ? (people[id] ?? "عضو في المنظمة") : "النظام");

  return (
    <section className="card mb-5 p-5" aria-labelledby="history-title" data-testid="proposal-history">
      <div className="mb-3 flex items-center gap-2">
        <History size={16} className="text-slate-400" />
        <h2 id="history-title" className="font-semibold text-white">السجل والمراجعات</h2>
        <span className="text-xs text-slate-500">النسخة الحالية {proposal.version}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {canComment && <CommentForm proposalId={proposal.id} orgId={proposal.organization_id} version={reviewedVersion(proposal.version)} />}
        {canSaveVersion && <SaveVersionForm proposalId={proposal.id} />}
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">لا توجد نسخ أو مراجعات بعد. تُحفظ نسخة تلقائيًا عند الإرسال للمراجعة والاعتماد والإرسال للعميل.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {entries.map((e) =>
            e.kind === "version" ? (
              <li key={`v-${e.row.id}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
                <Link href={`/proposals/${proposal.id}/versions/${e.row.version}`} className="font-medium text-emerald-300 hover:underline">
                  النسخة {e.row.version}
                </Link>
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${PROPOSAL_STATUS[e.row.status].tone}`}>{PROPOSAL_STATUS[e.row.status].label}</span>
                {e.row.note && <span className="text-slate-300">{e.row.note}</span>}
                <span className="ms-auto text-xs text-slate-500">{who(e.row.created_by)} · <bdi>{formatDateTime(e.row.created_at)}</bdi></span>
              </li>
            ) : (
              <li key={`r-${e.row.id}`} className="rounded-lg border border-slate-800 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`font-medium ${REVIEW_DECISION[e.row.decision].tone}`}>{REVIEW_DECISION[e.row.decision].label}</span>
                  <span className="text-xs text-slate-500">على النسخة {e.row.version}</span>
                  <span className="ms-auto text-xs text-slate-500">{who(e.row.reviewer_id)} · <bdi>{formatDateTime(e.row.created_at)}</bdi></span>
                </div>
                {e.row.comment && <p className="mt-1 whitespace-pre-wrap text-slate-200">{e.row.comment}</p>}
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}

function CommentForm({ proposalId, orgId, version }: { proposalId: string; orgId: string; version: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reviewProposal.bind(null, proposalId, orgId, version), {});
  return (
    <form action={action} className="space-y-2" key={state.ok ? state.message : "comment"}>
      <label htmlFor="proposal-comment" className="text-xs text-slate-400">تعليق للفريق</label>
      <textarea id="proposal-comment" name="comment" rows={2} className="field" placeholder="ملاحظة أو سؤال حول العرض…" />
      <input type="hidden" name="decision" value="comment" />
      <button className="btn-ghost" disabled={pending}><MessageSquare size={15} /> إضافة تعليق</button>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}

function SaveVersionForm({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveVersion.bind(null, proposalId), {});
  return (
    <form action={action} className="space-y-2" key={state.ok ? state.message : "version"}>
      <label htmlFor="version-note" className="text-xs text-slate-400">حفظ نسخة من المحتوى الحالي</label>
      <input id="version-note" name="note" maxLength={500} className="field" placeholder="وصف قصير للنسخة (اختياري)" />
      <button className="btn-ghost" disabled={pending}><Save size={15} /> حفظ نسخة</button>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      {state.ok && state.message && <p role="status" className="text-sm text-emerald-400">{state.message}</p>}
    </form>
  );
}
