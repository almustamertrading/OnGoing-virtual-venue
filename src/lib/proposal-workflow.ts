import type { ProposalReviewDecision, ProposalStatus } from "./types";

// Which workflow moves the UI offers. The database (proposals_workflow trigger, review and
// content policies) is the authority; this only decides which buttons make sense to show.

export type WorkflowMove = {
  to: ProposalStatus;
  label: string;
  tone: "primary" | "ghost";
  /** Asked before the move, when it has consequences worth a second look. */
  confirm?: string;
};

const EDITABLE: readonly ProposalStatus[] = ["draft", "ai_generated", "changes_requested"];
const CONVERTIBLE: readonly ProposalStatus[] = ["approved_internally", "sent_to_client", "awaiting_response", "accepted"];

/** Content (header, sections, items) can change only while drafting or revising. */
export function isEditable(status: ProposalStatus): boolean {
  return EDITABLE.includes(status);
}

const REOPEN: WorkflowMove = {
  to: "draft",
  label: "إعادة فتح للتعديل",
  tone: "ghost",
  confirm: "إعادة الفتح تُلغي الاعتماد الداخلي، وسيحتاج العرض إلى مراجعة واعتماد جديدين قبل إرساله. متابعة؟",
};

/** Next moves for someone with sales access or a manager role; none for anyone else. */
export function nextMoves(status: ProposalStatus, who: { sales: boolean; manager: boolean }): WorkflowMove[] {
  if (!who.sales && !who.manager) return [];
  switch (status) {
    case "draft":
    case "ai_generated":
    case "changes_requested":
      return [{ to: "under_review", label: "إرسال للمراجعة الداخلية", tone: "primary", confirm: "يُقفل المحتوى أثناء المراجعة وتُحفظ نسخة منه. إرسال العرض للمراجعة؟" }];
    case "under_review":
      return [{ to: "draft", label: "سحب من المراجعة للتعديل", tone: "ghost" }];
    case "approved_internally":
      return [{ to: "sent_to_client", label: "تحديد كمُرسل للعميل", tone: "primary" }, REOPEN];
    case "sent_to_client":
      return [
        { to: "awaiting_response", label: "بانتظار رد العميل", tone: "ghost" },
        { to: "accepted", label: "قبِل العميل", tone: "primary" },
        { to: "rejected", label: "رفض العميل", tone: "ghost" },
        REOPEN,
      ];
    case "awaiting_response":
      return [
        { to: "accepted", label: "قبِل العميل", tone: "primary" },
        { to: "rejected", label: "رفض العميل", tone: "ghost" },
        { to: "expired", label: "انتهت الصلاحية", tone: "ghost" },
        REOPEN,
      ];
    case "rejected":
    case "expired":
      return [{ ...REOPEN, confirm: undefined }];
    default:
      return [];
  }
}

/** Whether to offer "convert to project" (the database re-checks approval and rights). */
export function canConvert(status: ProposalStatus, linkedProject: boolean, who: { sales: boolean; manager: boolean }): boolean {
  return !linkedProject && (who.sales || who.manager) && CONVERTIBLE.includes(status);
}

export const REVIEW_DECISION: Record<ProposalReviewDecision, { label: string; tone: string }> = {
  comment: { label: "تعليق", tone: "text-slate-300" },
  changes_requested: { label: "طلب تعديلات", tone: "text-amber-300" },
  approved: { label: "اعتماد", tone: "text-emerald-300" },
};

/** The frozen version a review refers to: the one taken at submission (the current one minus one). */
export function reviewedVersion(currentVersion: number): number {
  return Math.max(1, currentVersion - 1);
}
