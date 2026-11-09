"use client";

import { useActionState, useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { PROPOSAL_STATUS } from "@/lib/proposal-meta";
import { canConvert, nextMoves, reviewedVersion } from "@/lib/proposal-workflow";
import type { ProposalRow, ProposalStatus } from "@/lib/types";
import { changeStatus, convertToProject, reviewProposal, type ActionState } from "../actions";

/**
 * Status, the next workflow moves for this person, the manager's review form, and conversion.
 * Every move is re-checked by the database, which refuses anything this person may not do.
 */
export function WorkflowPanel({
  proposal, canEdit, isManager, people,
}: {
  proposal: ProposalRow;
  canEdit: boolean;
  isManager: boolean;
  people: Record<string, string>;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const who = { sales: canEdit, manager: isManager };
  const moves = nextMoves(proposal.status, who);
  const status = PROPOSAL_STATUS[proposal.status];

  const run = (fn: () => Promise<ActionState | void>) =>
    start(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
    });

  return (
    <div className="space-y-3" data-testid="proposal-workflow">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`} data-testid="proposal-status">{status.label}</span>
        {proposal.status === "under_review" && proposal.submitted_at && (
          <span>أُرسل للمراجعة <bdi>{formatDateTime(proposal.submitted_at)}</bdi> · المحتوى مقفل حتى القرار</span>
        )}
        {proposal.approved_at && (
          <span className="text-teal-300">
            اعتمده {proposal.approved_by ? (people[proposal.approved_by] ?? "مدير المنظمة") : "مدير المنظمة"} · <bdi>{formatDateTime(proposal.approved_at)}</bdi>
          </span>
        )}
      </div>

      {(moves.length > 0 || canConvert(proposal.status, Boolean(proposal.project_id), who)) && (
        <div className="flex flex-wrap gap-2">
          {moves.map((m) => (
            <button
              key={m.to}
              type="button"
              className={m.tone === "primary" ? "btn-primary" : "btn-ghost"}
              disabled={busy}
              onClick={() => (!m.confirm || confirm(m.confirm)) && run(() => changeStatus(proposal.id, m.to))}
            >
              {m.label}
            </button>
          ))}
          {canConvert(proposal.status, Boolean(proposal.project_id), who) && (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => confirm("تحويل العرض إلى مشروع تشغيلي؟ يُنشأ المشروع وجدول كمياته بأسعار العميل (دون التكاليف الداخلية).") && run(() => convertToProject(proposal.id))}
            >
              <FileText size={15} /> تحويل إلى مشروع
            </button>
          )}
        </div>
      )}

      {isManager && proposal.status === "under_review" && (
        <ReviewForm proposalId={proposal.id} orgId={proposal.organization_id} version={reviewedVersion(proposal.version)} />
      )}

      {isManager && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          تغيير مباشر للحالة (للمدير):
          <select
            value={proposal.status}
            disabled={busy}
            onChange={(e) => run(() => changeStatus(proposal.id, e.target.value as ProposalStatus))}
            className="field w-44 py-1 text-xs"
          >
            {Object.entries(PROPOSAL_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
        </label>
      )}

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function ReviewForm({ proposalId, orgId, version }: { proposalId: string; orgId: string; version: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reviewProposal.bind(null, proposalId, orgId, version), {});
  return (
    <form action={action} className="space-y-2 rounded-lg border border-sky-900/60 bg-sky-950/20 p-3" aria-label="مراجعة العرض">
      <label htmlFor="review-comment" className="block text-xs font-medium text-sky-200">
        مراجعة النسخة {version} المرسلة
      </label>
      <textarea id="review-comment" name="comment" rows={2} className="field" placeholder="ملاحظات المراجعة (إلزامية عند طلب التعديلات)" />
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="approved" className="btn-primary" disabled={pending}>اعتماد العرض</button>
        <button name="decision" value="changes_requested" className="btn-ghost" disabled={pending}>طلب تعديلات</button>
      </div>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
