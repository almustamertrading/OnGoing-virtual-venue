import type { ProjectStatus, ProjectType, TaskPriority, TaskStatus } from "./types";

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: string }> = {
  lead: { label: "Lead", tone: "bg-slate-700 text-slate-100" },
  proposal: { label: "Proposal", tone: "bg-violet-900 text-violet-100" },
  confirmed: { label: "Confirmed", tone: "bg-sky-900 text-sky-100" },
  in_progress: { label: "In progress", tone: "bg-emerald-900 text-emerald-100" },
  completed: { label: "Completed", tone: "bg-slate-800 text-slate-300" },
  on_hold: { label: "On hold", tone: "bg-amber-900 text-amber-100" },
  cancelled: { label: "Cancelled", tone: "bg-red-950 text-red-200" },
};

export const PROJECT_TYPE: Record<ProjectType, string> = {
  sports_event: "Sports event",
  conference: "Conference",
  exhibition: "Exhibition",
  festival: "Festival",
  corporate_event: "Corporate event",
  production: "Production",
  other: "Other",
};

export const TASK_STATUS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export const TASK_PRIORITY: Record<TaskPriority, { label: string; tone: string }> = {
  low: { label: "Low", tone: "text-slate-400" },
  normal: { label: "Normal", tone: "text-slate-300" },
  high: { label: "High", tone: "text-amber-300" },
  urgent: { label: "Urgent", tone: "text-red-300" },
};

/** "2027-03-01" -> "1 Mar 2027", without time zone shifts. */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${month} ${y}`;
}

export function formatRange(start: string | null, end: string | null) {
  if (start && end && start !== end) return `${formatDate(start)} to ${formatDate(end)}`;
  return formatDate(start ?? end);
}

export function formatMoney(value: number | null | undefined, currency = "SAR") {
  if (value == null) return "";
  return `${currency} ${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Today's date in Riyadh as YYYY-MM-DD, for overdue checks. */
export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

export function isOverdue(due: string | null, done: boolean) {
  return Boolean(due) && !done && (due as string) < todayIso();
}
