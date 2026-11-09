/**
 * Reports & Analytics: pure helpers shared by the /reports page, its CSV export and its charts.
 *
 * The figures come only from the report RPCs (report_pipeline, report_proposals,
 * report_project_finance, report_delivery, report_procurement), which run as the caller,
 * so RLS has already decided what each person may see. Nothing here derives finance data
 * from other tables; it only sorts, totals and formats what came back.
 */
import { PROJECT_STATUS } from "./format";
import { PROPOSAL_STATUS } from "./proposal-meta";
import type {
  ProjectStatus,
  ProposalStatus,
  ReportDeliveryRow,
  ReportPipelineRow,
  ReportProcurementRow,
  ReportProjectFinanceRow,
  ReportProposalsRow,
} from "./types";

// ---------------------------------------------------------------------------
// Labels and status groups
// ---------------------------------------------------------------------------

/** Arabic project status labels for the (Arabic, right-to-left) reports page. */
export const PROJECT_STATUS_AR: Record<ProjectStatus, string> = {
  lead: "فرصة",
  proposal: "مرحلة العرض",
  confirmed: "مؤكد",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  on_hold: "معلّق",
  cancelled: "ملغى",
};

/** Arabic label of a project status; an unknown (newer) status shows as it is. */
export function projectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_AR[status] ?? status;
}

/** Lifecycle order of project statuses (the order of PROJECT_STATUS). */
export const PROJECT_STATUS_ORDER = Object.keys(PROJECT_STATUS) as ProjectStatus[];
/** Lifecycle order of proposal statuses (the order of PROPOSAL_STATUS). */
export const PROPOSAL_STATUS_ORDER = Object.keys(PROPOSAL_STATUS) as ProposalStatus[];

/** Projects still open: the same set as the "Active" filter on the Projects page. */
export const ACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = ["lead", "proposal", "confirmed", "in_progress", "on_hold"];
/** Proposals the client said yes to (an accepted proposal may already be converted to a project). */
export const WON_PROPOSAL_STATUSES: readonly ProposalStatus[] = ["accepted", "converted"];
export const LOST_PROPOSAL_STATUSES: readonly ProposalStatus[] = ["rejected"];

/** Shown (and exported) instead of a figure the viewer has no permission for; never shown as 0. */
export const RESTRICTED_LABEL = "مقيد";
export const TOTAL_LABEL = "الإجمالي";

/**
 * Chart colours for the dark theme, checked with the data-viz palette validator rather than by eye:
 * the bar (blue, dark-mode categorical slot 1) passes the lightness band, the chroma floor and
 * >= 3:1 contrast against both the card surface (slate-900/60 over the page, ~#0e1526) and the
 * page (#0b1120); the meter track is a darker step of the same blue ramp (ordinal check passed).
 * One series per chart, so every bar takes the same hue; labels use text colours, never the bar's.
 */
export const CHART_COLORS = { bar: "#3987e5", track: "#184f95", baseline: "#334155" } as const;

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** A finite number from an RPC value (numeric and bigint columns), or 0. */
export function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** Like toNum, but keeps null (a figure withheld from the caller) distinct from 0. */
export function toNumOrNull(value: unknown): number | null {
  return value == null ? null : toNum(value);
}

/** Sum of the finite values; null and undefined are skipped. */
export function sum(values: readonly (number | null | undefined)[]): number {
  return values.reduce<number>((total, v) => (typeof v === "number" && Number.isFinite(v) ? total + v : total), 0);
}

/** A ratio between 0 and 1, or null when there is nothing to divide by. */
export function ratio(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return Math.min(1, Math.max(0, part / whole));
}

/** "50%" for 0.5, and "—" when the ratio is undefined (nothing to divide by). */
export function formatPercent(rate: number | null): string {
  return rate == null ? "—" : `${Math.round(rate * 100)}%`;
}

const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Short figures for chart labels: 1,250,000 -> "1.3M". Tables keep the full amounts. */
export function formatCompact(value: number): string {
  return compactFormat.format(Number.isFinite(value) ? value : 0);
}

export function formatCompactMoney(value: number, currency = "SAR"): string {
  return `${currency} ${formatCompact(value)}`;
}

// ---------------------------------------------------------------------------
// RPC rows -> typed rows (numeric and bigint values arrive as JSON numbers; coerce defensively)
// ---------------------------------------------------------------------------

function rowsOf(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export function normalizePipeline(data: unknown): ReportPipelineRow[] {
  return rowsOf(data).map((r) => ({
    status: r.status as ProjectStatus,
    projects: toNum(r.projects),
    budget_total: toNum(r.budget_total),
  }));
}

export function normalizeProposals(data: unknown): ReportProposalsRow[] {
  return rowsOf(data).map((r) => ({
    status: r.status as ProposalStatus,
    proposals: toNum(r.proposals),
    value_total: toNum(r.value_total),
  }));
}

export function normalizeFinance(data: unknown): ReportProjectFinanceRow[] {
  return rowsOf(data).map((r) => ({
    project_id: String(r.project_id),
    code: String(r.code ?? ""),
    name: String(r.name ?? ""),
    status: r.status as ProjectStatus,
    budget: toNumOrNull(r.budget),
    invoiced: toNum(r.invoiced),
    paid: toNum(r.paid),
    outstanding: toNum(r.outstanding),
    expenses: toNum(r.expenses),
    margin: toNum(r.margin),
  }));
}

export function normalizeDelivery(data: unknown): ReportDeliveryRow[] {
  return rowsOf(data).map((r) => ({
    project_id: String(r.project_id),
    code: String(r.code ?? ""),
    name: String(r.name ?? ""),
    status: r.status as ProjectStatus,
    tasks_total: toNum(r.tasks_total),
    tasks_done: toNum(r.tasks_done),
    tasks_overdue: toNum(r.tasks_overdue),
    tasks_blocked: toNum(r.tasks_blocked),
    milestones_total: toNum(r.milestones_total),
    milestones_done: toNum(r.milestones_done),
    next_milestone: typeof r.next_milestone === "string" ? r.next_milestone : null,
  }));
}

/**
 * Procurement rows. Without finance access the quote figures stay null; `financeAccess: false`
 * also forces them to null, so a withheld figure can never be shown even if one slipped through.
 */
export function normalizeProcurement(data: unknown, financeAccess: boolean): ReportProcurementRow[] {
  return rowsOf(data).map((r) => ({
    project_id: String(r.project_id),
    code: String(r.code ?? ""),
    name: String(r.name ?? ""),
    rfqs: toNum(r.rfqs),
    rfqs_awarded: toNum(r.rfqs_awarded),
    quotes: financeAccess ? toNumOrNull(r.quotes) : null,
    awarded_value: financeAccess ? toNumOrNull(r.awarded_value) : null,
  }));
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "ar");

/**
 * Every project status in lifecycle order, with zero rows for statuses that have no projects.
 * A status this code does not know yet (added to the database later) is kept at the end, so
 * the totals always match what the report returned.
 */
export function pipelineByStatus(rows: readonly ReportPipelineRow[]): ReportPipelineRow[] {
  const found = new Map(rows.map((r) => [r.status, r]));
  const known = PROJECT_STATUS_ORDER.map((status) => found.get(status) ?? { status, projects: 0, budget_total: 0 });
  return [...known, ...rows.filter((r) => !PROJECT_STATUS_ORDER.includes(r.status))];
}

/** Proposal statuses that have proposals, in lifecycle order. */
export function proposalsByStatus(rows: readonly ReportProposalsRow[]): ReportProposalsRow[] {
  const rank = (s: ProposalStatus) => {
    const i = PROPOSAL_STATUS_ORDER.indexOf(s);
    return i === -1 ? PROPOSAL_STATUS_ORDER.length : i;
  };
  return rows.filter((r) => r.proposals > 0).sort((a, b) => rank(a.status) - rank(b.status));
}

/** Projects needing attention first: most overdue, then most blocked, then by name. */
export function sortDelivery(rows: readonly ReportDeliveryRow[]): ReportDeliveryRow[] {
  return [...rows].sort((a, b) => b.tasks_overdue - a.tasks_overdue || b.tasks_blocked - a.tasks_blocked || byName(a, b));
}

/** Projects that have requests for quotation, by name. */
export function procurementWithRfqs(rows: readonly ReportProcurementRow[]): ReportProcurementRow[] {
  return rows.filter((r) => r.rfqs > 0).sort(byName);
}

export function sortByName<T extends { name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort(byName);
}

// ---------------------------------------------------------------------------
// Totals and headline figures
// ---------------------------------------------------------------------------

/** Proposals won and lost, and the win rate: won ÷ (won + lost), null when nothing is decided yet. */
export function proposalOutcomes(rows: readonly ReportProposalsRow[]) {
  const count = (statuses: readonly ProposalStatus[]) =>
    sum(rows.filter((r) => statuses.includes(r.status)).map((r) => r.proposals));
  const won = count(WON_PROPOSAL_STATUSES);
  const lost = count(LOST_PROPOSAL_STATUSES);
  return { won, lost, rate: ratio(won, won + lost) };
}

/** Won ÷ decided: (accepted + converted) / (accepted + converted + rejected); null when nothing is decided. */
export function winRate(rows: readonly ReportProposalsRow[]): number | null {
  return proposalOutcomes(rows).rate;
}

export function pipelineTotals(rows: readonly ReportPipelineRow[]) {
  return { projects: sum(rows.map((r) => r.projects)), budget: sum(rows.map((r) => r.budget_total)) };
}

export function proposalTotals(rows: readonly ReportProposalsRow[]) {
  return { proposals: sum(rows.map((r) => r.proposals)), value: sum(rows.map((r) => r.value_total)) };
}

export function financeTotals(rows: readonly ReportProjectFinanceRow[]) {
  return {
    budget: sum(rows.map((r) => r.budget)),
    invoiced: sum(rows.map((r) => r.invoiced)),
    paid: sum(rows.map((r) => r.paid)),
    outstanding: sum(rows.map((r) => r.outstanding)),
    expenses: sum(rows.map((r) => r.expenses)),
    margin: sum(rows.map((r) => r.margin)),
  };
}

/**
 * Procurement totals. Quote figures withheld from the caller (null) are never counted as 0:
 * a column is null when every row is withheld, and `partial` says some rows were left out.
 */
export function procurementTotals(rows: readonly ReportProcurementRow[]) {
  const visible = rows.filter((r) => r.quotes != null);
  const allWithheld = rows.length > 0 && visible.length === 0;
  return {
    rfqs: sum(rows.map((r) => r.rfqs)),
    rfqsAwarded: sum(rows.map((r) => r.rfqs_awarded)),
    quotes: allWithheld ? null : sum(visible.map((r) => r.quotes)),
    awardedValue: allWithheld ? null : sum(rows.map((r) => r.awarded_value)),
    partial: visible.length > 0 && visible.length < rows.length,
  };
}

export type ReportSummary = {
  activeProjects: number;
  /** Total budget of active projects. */
  pipelineValue: number;
  winRate: number | null;
  overdueTasks: number;
  /** Invoiced but not yet paid, over the projects whose finance the caller can see. */
  outstanding: number;
};

export function reportSummary(input: {
  pipeline: readonly ReportPipelineRow[];
  proposals: readonly ReportProposalsRow[];
  delivery: readonly ReportDeliveryRow[];
  finance: readonly ReportProjectFinanceRow[];
}): ReportSummary {
  const active = input.pipeline.filter((r) => ACTIVE_PROJECT_STATUSES.includes(r.status));
  return {
    activeProjects: sum(active.map((r) => r.projects)),
    pipelineValue: sum(active.map((r) => r.budget_total)),
    winRate: winRate(input.proposals),
    overdueTasks: sum(input.delivery.map((r) => r.tasks_overdue)),
    outstanding: financeTotals(input.finance).outstanding,
  };
}

// ---------------------------------------------------------------------------
// Bar chart geometry
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Bar lengths in pixels, proportional to the largest positive value on a `track` pixels long.
 * Zero, negative and non-finite values get no bar; if no value is positive, no bar is drawn
 * (no division by zero). A positive value is never drawn thinner than `minVisible`.
 */
export function barScale(values: readonly number[], track: number, minVisible = 2): number[] {
  const length = Number.isFinite(track) && track > 0 ? track : 0;
  const clean = values.map((v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0));
  const max = clean.reduce((m, v) => (v > m ? v : m), 0);
  if (max === 0 || length === 0) return clean.map(() => 0);
  const floor = Math.min(Math.max(0, minVisible), length);
  return clean.map((v) => (v === 0 ? 0 : Math.max(floor, round2((v / max) * length))));
}

/**
 * SVG path of a horizontal bar growing leftwards (right-to-left) from `baseline`: square where
 * it meets the baseline, rounded by `radius` at the data end. Empty for a zero-length bar.
 */
export function barPathRtl(baseline: number, y: number, length: number, thickness: number, radius = 4): string {
  if (!(length > 0) || !(thickness > 0)) return "";
  const r = round2(Math.min(Math.max(0, radius), length, thickness / 2));
  const left = round2(baseline - length);
  const [b, top, bottom] = [round2(baseline), round2(y), round2(y + thickness)];
  return (
    `M${b},${top}H${round2(left + r)}A${r},${r} 0 0 0 ${left},${round2(top + r)}` +
    `V${round2(bottom - r)}A${r},${r} 0 0 0 ${round2(left + r)},${bottom}H${b}Z`
  );
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export type CsvCell = string | number | null | undefined;
export type CsvTable = { header: string[]; rows: CsvCell[][] };

/** Byte order mark: tells Excel the file is UTF-8, so Arabic text opens correctly. */
export const CSV_BOM = "﻿";

/** Text a spreadsheet would run as a formula (CSV/formula injection): = + - @ tab, carriage return. */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * One CSV field. Numbers are written as they are (a number cannot carry a formula, and negative
 * amounts stay numeric). Text that starts like a formula is prefixed with an apostrophe, and
 * text containing a quote, comma or line break is quoted with its quotes doubled (RFC 4180).
 */
export function csvCell(value: CsvCell): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = String(value);
  if (FORMULA_TRIGGER.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A CSV document: UTF-8 BOM, a header row, then the rows; CRLF line endings. */
export function buildCsv(header: readonly CsvCell[], rows: readonly (readonly CsvCell[])[]): string {
  return CSV_BOM + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** "ongoing-pipeline-2026-11-09.csv": the section and the date, safe for any file system. */
export function csvFileName(section: string, date: string): string {
  const slug = section.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `ongoing-${slug}-${date}.csv` : `ongoing-${slug}.csv`;
}

const money = (label: string, currency: string) => `${label} (${currency})`;
const restricted = (value: number | null): CsvCell => (value == null ? RESTRICTED_LABEL : value);

export function pipelineCsv(rows: readonly ReportPipelineRow[], currency: string): CsvTable {
  const totals = pipelineTotals(rows);
  return {
    header: ["الحالة", "عدد المشاريع", money("إجمالي الميزانيات", currency)],
    rows: [
      ...rows.map((r) => [projectStatusLabel(r.status), r.projects, r.budget_total]),
      [TOTAL_LABEL, totals.projects, totals.budget],
    ],
  };
}

export function proposalsCsv(rows: readonly ReportProposalsRow[], currency: string): CsvTable {
  const totals = proposalTotals(rows);
  return {
    header: ["الحالة", "عدد العروض", money("القيمة", currency)],
    rows: [
      ...rows.map((r) => [PROPOSAL_STATUS[r.status]?.label ?? r.status, r.proposals, r.value_total]),
      [TOTAL_LABEL, totals.proposals, totals.value],
    ],
  };
}

export function deliveryCsv(rows: readonly ReportDeliveryRow[]): CsvTable {
  return {
    header: [
      "رمز المشروع", "المشروع", "الحالة", "إجمالي المهام", "المهام المنجزة", "نسبة الإنجاز (%)",
      "المهام المتأخرة", "المهام المعطّلة", "المعالم المنجزة", "إجمالي المعالم", "المعلم القادم",
    ],
    rows: rows.map((r) => {
      const done = ratio(r.tasks_done, r.tasks_total);
      return [
        r.code, r.name, projectStatusLabel(r.status), r.tasks_total, r.tasks_done,
        done == null ? "" : Math.round(done * 100), r.tasks_overdue, r.tasks_blocked,
        r.milestones_done, r.milestones_total, r.next_milestone ?? "",
      ];
    }),
  };
}

export function procurementCsv(rows: readonly ReportProcurementRow[], currency: string): CsvTable {
  const totals = procurementTotals(rows);
  return {
    header: ["رمز المشروع", "المشروع", "طلبات التسعير", "تمت ترسيتها", "عروض الموردين", money("قيمة الترسية", currency)],
    rows: [
      ...rows.map((r) => [r.code, r.name, r.rfqs, r.rfqs_awarded, restricted(r.quotes), restricted(r.awarded_value)]),
      ["", TOTAL_LABEL, totals.rfqs, totals.rfqsAwarded, restricted(totals.quotes), restricted(totals.awardedValue)],
    ],
  };
}

export function financeCsv(rows: readonly ReportProjectFinanceRow[], currency: string): CsvTable {
  const t = financeTotals(rows);
  return {
    header: [
      "رمز المشروع", "المشروع", "الحالة", money("الميزانية", currency), money("المفوتر", currency),
      money("المحصّل", currency), money("المستحق", currency), money("المصروفات", currency), money("الهامش", currency),
    ],
    rows: [
      ...rows.map((r) => [
        r.code, r.name, projectStatusLabel(r.status), r.budget, r.invoiced, r.paid, r.outstanding, r.expenses, r.margin,
      ]),
      ["", TOTAL_LABEL, "", t.budget, t.invoiced, t.paid, t.outstanding, t.expenses, t.margin],
    ],
  };
}
