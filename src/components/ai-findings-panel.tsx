"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, ChevronDown, Copy, FileText, RotateCcw, TriangleAlert } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { AiFindingRow } from "@/lib/types";

type Result = { error?: string; ok?: boolean };

const SEVERITY: Record<AiFindingRow["severity"], { label: string; tone: string }> = {
  critical: { label: "حرج", tone: "bg-red-950 text-red-200" },
  warning: { label: "مهم", tone: "bg-amber-950 text-amber-200" },
  info: { label: "معلومة", tone: "bg-slate-800 text-slate-300" },
};

/**
 * AI findings awaiting review, and the decisions already taken. Shared by every AI workflow: each finding
 * shows where it came from (document, page, quoted excerpt, whether that excerpt was found on that page)
 * and can be accepted or rejected by someone with the right permission. The database records who decided.
 */
export function AiFindingsPanel({
  title, findings, kindLabel, documents, people, canReview, acceptLabels = {}, defaultAcceptLabel = "اعتماد", copyKinds = [], emptyText,
  sourceLabel, verifiedText, unverifiedText, onAccept, onReject, onReopen,
}: {
  title: string;
  findings: AiFindingRow[];
  kindLabel: Record<string, string>;
  /** Document id → title, for the source line. */
  documents: Record<string, string>;
  /** User id → display name, for reviewers. */
  people: Record<string, string>;
  canReview: boolean;
  /** Button text per kind (e.g. "add to the register"); serialisable, so it can come from a server page. */
  acceptLabels?: Record<string, string>;
  defaultAcceptLabel?: string;
  /** Kinds whose title is text to copy (e.g. clarification questions). */
  copyKinds?: string[];
  emptyText: string;
  /** Shown as the source when a finding comes from text rather than a document (e.g. "the report"). */
  sourceLabel?: string;
  /** Wording of the source check, when the source is not a document (e.g. figures checked against data). */
  verifiedText?: string;
  unverifiedText?: string;
  onAccept: (id: string, kind: string, note: string) => Promise<Result>;
  onReject: (id: string, note: string) => Promise<Result>;
  onReopen: (id: string) => Promise<Result>;
}) {
  const proposed = findings.filter((f) => f.status === "proposed");
  const reviewed = findings.filter((f) => f.status !== "proposed");
  const order = Object.keys(kindLabel);
  const groups = order
    .map((kind) => ({ kind, items: proposed.filter((f) => f.kind === kind) }))
    .filter((g) => g.items.length > 0);
  const others = proposed.filter((f) => !order.includes(f.kind));
  if (others.length) groups.push({ kind: "other", items: others });

  return (
    <section className="card p-5" aria-labelledby="ai-findings-title" data-testid="ai-findings">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="ai-findings-title" className="font-semibold text-white">{title}</h2>
        <span className="text-xs text-slate-400" aria-live="polite">{proposed.length} بانتظار المراجعة · {reviewed.length} تمت مراجعتها</span>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        نتائج مقترحة من الذكاء الاصطناعي. لا يُعتمد شيء قبل قبوله من عضو مخوّل، ويُسجَّل اسمه ووقت القرار.
      </p>

      {proposed.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.kind}>
              <h3 className="mb-2 text-sm font-medium text-slate-300">{kindLabel[g.kind] ?? "أخرى"} ({g.items.length})</h3>
              <ul className="space-y-2">
                {g.items.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    documentTitle={f.document_id ? documents[f.document_id] : sourceLabel}
                    verifiedText={verifiedText}
                    unverifiedText={unverifiedText}
                    canReview={canReview}
                    acceptLabel={acceptLabels[f.kind] ?? defaultAcceptLabel}
                    copyable={copyKinds.includes(f.kind)}
                    onAccept={onAccept}
                    onReject={onReject}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <details className="group mt-5">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-slate-300">
            <ChevronDown size={15} className="transition group-open:rotate-180" /> تمت مراجعتها ({reviewed.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {reviewed.map((f) => (
              <ReviewedItem key={f.id} finding={f} kindLabel={kindLabel} people={people} canReview={canReview} onReopen={onReopen} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function SourceLine({
  finding, documentTitle, verifiedText = "المصدر مُتحقَّق منه", unverifiedText = "لم يُعثر على النص المقتبس في الملف، راجع المصدر",
}: { finding: AiFindingRow; documentTitle?: string; verifiedText?: string; unverifiedText?: string }) {
  if (!finding.source_excerpt && !finding.source_page) return null;
  const corrected = finding.data?.page_corrected === true;
  return (
    <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/60 p-2 text-xs">
      <p className="flex flex-wrap items-center gap-1 text-slate-400">
        <FileText size={13} aria-hidden />
        <span>{documentTitle ?? "مصدر محذوف"}</span>
        {finding.source_page && <span>· صفحة {finding.source_page}{corrected ? " (صُحّح رقم الصفحة)" : ""}</span>}
        {finding.source_verified ? (
          <span className="ms-auto inline-flex items-center gap-1 text-emerald-300"><BadgeCheck size={13} aria-hidden /> {verifiedText}</span>
        ) : (
          <span className="ms-auto inline-flex items-center gap-1 text-amber-300"><TriangleAlert size={13} aria-hidden /> {unverifiedText}</span>
        )}
      </p>
      {finding.source_excerpt && (
        <blockquote dir="auto" className="mt-1 border-s-2 border-slate-700 ps-2 text-slate-300">“{finding.source_excerpt}”</blockquote>
      )}
    </div>
  );
}

function FindingCard({
  finding, documentTitle, verifiedText, unverifiedText, canReview, acceptLabel, copyable, onAccept, onReject,
}: {
  finding: AiFindingRow;
  documentTitle?: string;
  verifiedText?: string;
  unverifiedText?: string;
  canReview: boolean;
  acceptLabel: string;
  copyable: boolean;
  onAccept: (id: string, kind: string, note: string) => Promise<Result>;
  onReject: (id: string, note: string) => Promise<Result>;
}) {
  const [busy, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sev = SEVERITY[finding.severity];
  const due = typeof finding.data?.due_date === "string" ? finding.data.due_date : "";

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
    });

  return (
    <li className="rounded-lg border border-slate-800 p-3" data-testid="finding">
      <div className="flex flex-wrap items-start gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${sev.tone}`}>{sev.label}</span>
        <p className="min-w-0 flex-1 text-sm font-medium text-slate-100" dir="auto">{finding.title}</p>
        {due && <span className="text-xs text-slate-400">الموعد: <bdi>{due}</bdi></span>}
      </div>
      {typeof finding.data?.suggested_assignee_label === "string" && (
        <p className="mt-1 text-xs text-slate-400">المسؤول المقترح: <bdi>{finding.data.suggested_assignee_label}</bdi></p>
      )}
      {finding.detail && <p className="mt-1 text-sm text-slate-400" dir="auto">{finding.detail}</p>}
      <SourceLine finding={finding} documentTitle={documentTitle} verifiedText={verifiedText} unverifiedText={unverifiedText} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canReview && (
          <>
            <label className="sr-only" htmlFor={`note-${finding.id}`}>ملاحظة المراجعة</label>
            <input id={`note-${finding.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
              placeholder="ملاحظة (اختياري)" className="field min-w-0 flex-1 py-1 text-xs" />
            <button type="button" className="btn-primary py-1 text-xs" disabled={busy}
              aria-label={`${acceptLabel}: ${finding.title}`} onClick={() => run(() => onAccept(finding.id, finding.kind, note))}>
              {acceptLabel}
            </button>
            <button type="button" className="btn-ghost py-1 text-xs" disabled={busy}
              aria-label={`رفض: ${finding.title}`} onClick={() => run(() => onReject(finding.id, note))}>
              رفض
            </button>
          </>
        )}
        {copyable && (
          <button type="button" className="btn-ghost py-1 text-xs"
            onClick={() => navigator.clipboard?.writeText(finding.title).then(() => setCopied(true), () => setCopied(false))}>
            <Copy size={13} /> {copied ? "نُسخ" : "نسخ السؤال"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </li>
  );
}

function ReviewedItem({
  finding, kindLabel, people, canReview, onReopen,
}: {
  finding: AiFindingRow;
  kindLabel: Record<string, string>;
  people: Record<string, string>;
  canReview: boolean;
  onReopen: (id: string) => Promise<Result>;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const accepted = finding.status === "accepted";
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-slate-800 px-3 py-2 text-sm" data-testid="reviewed-finding">
      <span className={`rounded px-1.5 py-0.5 text-[11px] ${accepted ? "bg-emerald-950 text-emerald-200" : "bg-slate-800 text-slate-300"}`}>
        {accepted ? "مقبول" : "مرفوض"}
      </span>
      <span className="text-xs text-slate-500">{kindLabel[finding.kind] ?? finding.kind}</span>
      <span className="min-w-0 flex-1 text-slate-200" dir="auto">{finding.title}</span>
      <span className="text-xs text-slate-500">
        {finding.reviewed_by ? (people[finding.reviewed_by] ?? "عضو") : "—"} · <bdi>{formatDateTime(finding.reviewed_at)}</bdi>
      </span>
      {finding.review_note && <span className="w-full text-xs text-slate-400">{finding.review_note}</span>}
      {canReview && (
        <button type="button" className="btn-ghost py-0.5 text-xs" disabled={busy}
          onClick={() => start(async () => { setError(null); const r = await onReopen(finding.id); if (r.error) setError(r.error); })}>
          <RotateCcw size={12} /> إعادة فتح
        </button>
      )}
      {error && <p role="alert" className="w-full text-xs text-red-400">{error}</p>}
    </li>
  );
}
