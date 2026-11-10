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

/** A real calendar date written YYYY-MM-DD. "2027-02-30" is not one, although Date.parse accepts it. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

const RIYADH_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** A timestamp in Riyadh time: "9 Nov 2026, 14:05". Numeric parts only, so server and browser agree. */
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(RIYADH_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return `${formatDate(`${p.year}-${p.month}-${p.day}`)}, ${p.hour}:${p.minute}`;
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
