import Link from "next/link";
import { AlertTriangle, Lock } from "lucide-react";
import { Restricted } from "@/components/restricted";
import { PROJECT_STATUS, formatDate, formatMoney } from "@/lib/format";
import { PROPOSAL_STATUS } from "@/lib/proposal-meta";
import {
  CHART_COLORS,
  RESTRICTED_LABEL,
  TOTAL_LABEL,
  deliveryCsv,
  financeCsv,
  financeTotals,
  formatCompactMoney,
  formatPercent,
  pipelineCsv,
  pipelineTotals,
  procurementCsv,
  procurementTotals,
  projectStatusLabel,
  proposalOutcomes,
  proposalTotals,
  proposalsCsv,
  ratio,
  type ReportSummary,
} from "@/lib/reports";
import type {
  ProjectStatus,
  ReportDeliveryRow,
  ReportPipelineRow,
  ReportProcurementRow,
  ReportProjectFinanceRow,
  ReportProposalsRow,
} from "@/lib/types";
import { BarChart, type BarDatum } from "./bar-chart";
import { CsvButton } from "./csv-button";

export const REPORT_SECTIONS = [
  { id: "pipeline", label: "خط المشاريع" },
  { id: "proposals", label: "العروض" },
  { id: "delivery", label: "التنفيذ" },
  { id: "procurement", label: "المشتريات" },
  { id: "finance", label: "المالية" },
] as const;

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Section({ id, title, description, action, children }: {
  id: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="card scroll-mt-4 p-4 sm:p-5" data-testid={`section-${id}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-semibold text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Wide tables scroll inside their own box (keyboard-focusable), never the page. */
function TableScroll({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="-mx-4 overflow-x-auto px-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 sm:mx-0 sm:px-0"
    >
      {children}
    </div>
  );
}

const TH = "px-2 py-2 font-medium whitespace-nowrap";
const TD = "px-2 py-2 whitespace-nowrap tabular-nums";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}

function LoadError() {
  return (
    <p role="alert" className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
      تعذّر تحميل هذا التقرير. حدّث الصفحة، وإن تكرر الخطأ فأبلغ مدير المنظمة.
    </p>
  );
}

function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PROJECT_STATUS[status]?.tone ?? "bg-slate-700 text-slate-100"}`}>
      {projectStatusLabel(status)}
    </span>
  );
}

/** A figure withheld by the finance permission: a lock and "مقيد", never a misleading 0. */
function RestrictedValue() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400" title="مقيد بصلاحية المالية" data-testid="restricted-value">
      <Lock size={12} aria-hidden className="text-amber-300" /> {RESTRICTED_LABEL}
    </span>
  );
}

/** Project names are free text (Latin or Arabic): <bdi> keeps "=1+2 Gala" from being reordered in RTL. */
function ProjectCell({ id, name, code, tab }: { id: string; name: string; code: string; tab?: string }) {
  return (
    <th scope="row" className="px-2 py-2 text-right font-normal">
      <Link href={`/projects/${id}${tab ? `/${tab}` : ""}`} className="font-medium text-slate-100 hover:text-emerald-300">
        <bdi>{name}</bdi>
      </Link>
      {code && <span className="block font-mono text-[11px] text-slate-500">{code}</span>}
    </th>
  );
}

/** Task completion as a thin meter that fills from the right; the figure beside it carries the value. */
function Meter({ value }: { value: number }) {
  const width = 56;
  const fill = Math.round(Math.min(1, Math.max(0, value)) * width);
  return (
    <svg width={width} height={6} viewBox={`0 0 ${width} 6`} aria-hidden className="shrink-0">
      <rect width={width} height={6} rx={3} fill={CHART_COLORS.track} />
      {fill > 0 && <rect x={width - fill} width={fill} height={6} rx={3} fill={CHART_COLORS.bar} />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function ReportNav() {
  return (
    <nav aria-label="أقسام التقرير" className="flex flex-wrap gap-1.5">
      {REPORT_SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="rounded-md border border-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
          {s.label}
        </a>
      ))}
    </nav>
  );
}

export function SummaryCards({ summary, currency, showReceivables }: {
  summary: ReportSummary;
  currency: string;
  /** Finance users only. */
  showReceivables: boolean;
}) {
  const cards: { key: string; label: string; value: string; hint: string; alert?: boolean }[] = [
    { key: "active", label: "المشاريع النشطة", value: String(summary.activeProjects), hint: "غير المكتملة وغير الملغاة" },
    { key: "pipeline", label: "قيمة خط المشاريع", value: formatMoney(summary.pipelineValue, currency), hint: "ميزانيات المشاريع النشطة" },
    { key: "win-rate", label: "نسبة الفوز", value: formatPercent(summary.winRate), hint: "المقبولة من العروض المحسومة" },
    {
      key: "overdue", label: "المهام المتأخرة", value: String(summary.overdueTasks),
      hint: "تجاوزت تاريخ استحقاقها", alert: summary.overdueTasks > 0,
    },
  ];
  if (showReceivables) {
    cards.push({ key: "receivables", label: "المستحق من العملاء", value: formatMoney(summary.outstanding, currency), hint: "فواتير لم تُحصَّل بعد" });
  }

  return (
    <section aria-label="ملخص التقارير" className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${showReceivables ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
      {cards.map((c) => (
        <div key={c.key} className="card min-w-0 p-3" data-testid={`summary-${c.key}`}>
          <p className="text-xs text-slate-500">{c.label}</p>
          <p className={`mt-1 flex items-center gap-1.5 text-base font-bold [overflow-wrap:anywhere] sm:text-lg ${c.alert ? "text-red-300" : "text-white"}`}>
            {c.alert && <AlertTriangle size={16} aria-hidden className="shrink-0" />}
            <span data-value>{c.value}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">{c.hint}</p>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export function PipelineSection({ rows, currency, failed }: { rows: ReportPipelineRow[]; currency: string; failed: boolean }) {
  const totals = pipelineTotals(rows);
  const hasData = !failed && totals.projects > 0;
  const counts: BarDatum[] = rows.map((r) => ({
    key: r.status, label: projectStatusLabel(r.status), value: r.projects, display: String(r.projects), full: String(r.projects),
  }));
  const budgets: BarDatum[] = rows.map((r) => ({
    key: r.status, label: projectStatusLabel(r.status), value: r.budget_total,
    display: formatCompactMoney(r.budget_total, currency), full: formatMoney(r.budget_total, currency),
  }));

  return (
    <Section
      id="pipeline"
      title="خط المشاريع"
      description="المشاريع حسب الحالة، مع عددها وإجمالي ميزانياتها."
      action={hasData && <CsvButton section="pipeline" label="جدول خط المشاريع" {...pipelineCsv(rows, currency)} />}
    >
      {failed ? <LoadError /> : !hasData ? <Empty>لا توجد مشاريع بعد.</Empty> : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <BarChart title="عدد المشاريع حسب الحالة" data={counts} />
            <BarChart title="إجمالي الميزانيات حسب الحالة" data={budgets} />
          </div>
          <TableScroll label="جدول خط المشاريع">
            <table className="mt-5 w-full text-right text-sm" data-testid="pipeline-table">
              <caption className="sr-only">خط المشاريع حسب الحالة</caption>
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th scope="col" className={TH}>الحالة</th>
                  <th scope="col" className={TH}>عدد المشاريع</th>
                  <th scope="col" className={TH}>إجمالي الميزانيات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {rows.map((r) => (
                  <tr key={r.status} className={r.projects === 0 ? "text-slate-500" : undefined}>
                    <th scope="row" className="px-2 py-2 text-right font-normal"><StatusPill status={r.status} /></th>
                    <td className={TD} data-col="projects">{r.projects}</td>
                    <td className={TD} data-col="budget">{formatMoney(r.budget_total, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 font-semibold text-white">
                  <th scope="row" className="px-2 py-2 text-right">{TOTAL_LABEL}</th>
                  <td className={TD}>{totals.projects}</td>
                  <td className={TD}>{formatMoney(totals.budget, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </TableScroll>
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Proposals funnel
// ---------------------------------------------------------------------------

export function ProposalsSection({ rows, currency, failed }: { rows: ReportProposalsRow[]; currency: string; failed: boolean }) {
  const totals = proposalTotals(rows);
  const outcomes = proposalOutcomes(rows);
  const hasData = !failed && rows.length > 0;
  const label = (r: ReportProposalsRow) => PROPOSAL_STATUS[r.status]?.label ?? r.status;
  const counts: BarDatum[] = rows.map((r) => ({
    key: r.status, label: label(r), value: r.proposals, display: String(r.proposals), full: String(r.proposals),
  }));
  const values: BarDatum[] = rows.map((r) => ({
    key: r.status, label: label(r), value: r.value_total,
    display: formatCompactMoney(r.value_total, currency), full: formatMoney(r.value_total, currency),
  }));

  return (
    <Section
      id="proposals"
      title="قمع العروض"
      description="العروض حسب الحالة وقيمتها (البنود غير الاختيارية قبل الضريبة)، ونسبة الفوز."
      action={hasData && <CsvButton section="proposals" label="جدول العروض" {...proposalsCsv(rows, currency)} />}
    >
      {failed ? <LoadError /> : !hasData ? <Empty>لا توجد عروض بعد.</Empty> : (
        <>
          <p className="mb-4 text-sm text-slate-300" data-testid="win-rate">
            {/* Isolated, so the figure never merges with the number after it in right-to-left text. */}
            نسبة الفوز: <strong className="text-white"><bdi>{formatPercent(outcomes.rate)}</bdi></strong>{" "}
            <span className="ms-1 text-xs text-slate-500">
              {outcomes.rate == null
                ? "لا توجد عروض محسومة (مقبولة أو مرفوضة) بعد."
                : `${outcomes.won} مقبولة أو محوّلة من ${outcomes.won + outcomes.lost} محسومة.`}
            </span>
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <BarChart title="عدد العروض حسب الحالة" data={counts} />
            <BarChart title="قيمة العروض حسب الحالة" data={values} />
          </div>
          <TableScroll label="جدول العروض">
            <table className="mt-5 w-full text-right text-sm" data-testid="proposals-table">
              <caption className="sr-only">العروض حسب الحالة</caption>
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th scope="col" className={TH}>الحالة</th>
                  <th scope="col" className={TH}>عدد العروض</th>
                  <th scope="col" className={TH}>القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {rows.map((r) => (
                  <tr key={r.status}>
                    <th scope="row" className="px-2 py-2 text-right font-normal">
                      <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${PROPOSAL_STATUS[r.status]?.tone ?? ""}`}>{label(r)}</span>
                    </th>
                    <td className={TD} data-col="proposals">{r.proposals}</td>
                    <td className={TD} data-col="value">{formatMoney(r.value_total, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 font-semibold text-white">
                  <th scope="row" className="px-2 py-2 text-right">{TOTAL_LABEL}</th>
                  <td className={TD}>{totals.proposals}</td>
                  <td className={TD}>{formatMoney(totals.value, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </TableScroll>
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export function DeliverySection({ rows, failed }: { rows: ReportDeliveryRow[]; failed: boolean }) {
  const hasData = !failed && rows.length > 0;
  return (
    <Section
      id="delivery"
      title="التنفيذ"
      description="إنجاز المهام والمتأخر والمعطّل منها، والمعالم لكل مشروع. المشاريع ذات المهام المتأخرة أولًا."
      action={hasData && <CsvButton section="delivery" label="جدول التنفيذ" {...deliveryCsv(rows)} />}
    >
      {failed ? <LoadError /> : !hasData ? <Empty>لا توجد مشاريع بعد.</Empty> : (
        <TableScroll label="جدول التنفيذ">
          <table className="w-full min-w-[760px] text-right text-sm" data-testid="delivery-table">
            <caption className="sr-only">تقدّم التنفيذ لكل مشروع</caption>
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th scope="col" className={TH}>المشروع</th>
                <th scope="col" className={TH}>الحالة</th>
                <th scope="col" className={TH}>إنجاز المهام</th>
                <th scope="col" className={TH}>متأخرة</th>
                <th scope="col" className={TH}>معطّلة</th>
                <th scope="col" className={TH}>المعالم المنجزة</th>
                <th scope="col" className={TH}>المعلم القادم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {rows.map((r) => {
                const done = ratio(r.tasks_done, r.tasks_total);
                const overdue = r.tasks_overdue > 0;
                return (
                  <tr key={r.project_id} data-overdue={overdue ? "true" : undefined} className={overdue ? "bg-red-500/[0.07]" : undefined}>
                    <ProjectCell id={r.project_id} name={r.name} code={r.code} tab="tasks" />
                    <td className="px-2 py-2"><StatusPill status={r.status} /></td>
                    <td className={TD} data-col="completion">
                      {done == null ? (
                        <span className="text-xs text-slate-500">لا مهام</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Meter value={done} />
                          <span>{formatPercent(done)}</span>
                          <span className="text-xs text-slate-500">{r.tasks_done}/{r.tasks_total}</span>
                        </span>
                      )}
                    </td>
                    <td className={TD} data-col="overdue">
                      {overdue ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-950 px-2 py-0.5 text-xs font-medium text-red-200">
                          <AlertTriangle size={12} aria-hidden /> {r.tasks_overdue} متأخرة
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className={TD} data-col="blocked">
                      <span className={r.tasks_blocked > 0 ? "font-medium text-amber-300" : "text-slate-500"}>{r.tasks_blocked}</span>
                    </td>
                    <td className={TD} data-col="milestones">{r.milestones_done}/{r.milestones_total}</td>
                    {/* "1 Jun 2099" is left-to-right text: isolated so RTL does not show "Jun 2099 1". */}
                    <td className={TD} data-col="next-milestone">{r.next_milestone ? <bdi>{formatDate(r.next_milestone)}</bdi> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------

export function ProcurementSection({ rows, currency, failed }: { rows: ReportProcurementRow[]; currency: string; failed: boolean }) {
  const totals = procurementTotals(rows);
  const hasData = !failed && rows.length > 0;
  const anyWithheld = rows.some((r) => r.quotes == null);
  return (
    <Section
      id="procurement"
      title="المشتريات"
      description="طلبات التسعير وما تمت ترسيته، وعروض الموردين وقيمة الترسية لكل مشروع."
      action={hasData && <CsvButton section="procurement" label="جدول المشتريات" {...procurementCsv(rows, currency)} />}
    >
      {failed ? <LoadError /> : !hasData ? <Empty>لا توجد طلبات تسعير بعد.</Empty> : (
        <>
          <TableScroll label="جدول المشتريات">
            <table className="w-full min-w-[560px] text-right text-sm" data-testid="procurement-table">
              <caption className="sr-only">المشتريات لكل مشروع</caption>
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th scope="col" className={TH}>المشروع</th>
                  <th scope="col" className={TH}>طلبات التسعير</th>
                  <th scope="col" className={TH}>تمت ترسيتها</th>
                  <th scope="col" className={TH}>عروض الموردين</th>
                  <th scope="col" className={TH}>قيمة الترسية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {rows.map((r) => (
                  <tr key={r.project_id}>
                    <ProjectCell id={r.project_id} name={r.name} code={r.code} tab="procurement" />
                    <td className={TD} data-col="rfqs">{r.rfqs}</td>
                    <td className={TD} data-col="awarded">{r.rfqs_awarded}</td>
                    <td className={TD} data-col="quotes">{r.quotes == null ? <RestrictedValue /> : r.quotes}</td>
                    <td className={TD} data-col="awarded-value">{r.awarded_value == null ? <RestrictedValue /> : formatMoney(r.awarded_value, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 font-semibold text-white">
                  <th scope="row" className="px-2 py-2 text-right">{TOTAL_LABEL}</th>
                  <td className={TD}>{totals.rfqs}</td>
                  <td className={TD}>{totals.rfqsAwarded}</td>
                  <td className={TD}>{totals.quotes == null ? <RestrictedValue /> : `${totals.quotes}${totals.partial ? " *" : ""}`}</td>
                  <td className={TD}>
                    {totals.awardedValue == null ? <RestrictedValue /> : `${formatMoney(totals.awardedValue, currency)}${totals.partial ? " *" : ""}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableScroll>
          {anyWithheld && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
              <Lock size={12} aria-hidden className="mt-0.5 shrink-0 text-amber-300" />
              {totals.partial
                ? "* المجاميع لا تشمل المشاريع التي لا تملك صلاحية ماليتها."
                : "عروض الموردين وقيمها تكاليف داخلية، تظهر لأصحاب صلاحية المالية على المشروع فقط."}
            </p>
          )}
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Finance per project
// ---------------------------------------------------------------------------

export type FinanceState = "visible" | "empty" | "restricted" | "failed";

export function FinanceSection({ state, rows, currency }: { state: FinanceState; rows: ReportProjectFinanceRow[]; currency: string }) {
  const totals = financeTotals(rows);
  const visible = state === "visible";
  return (
    <Section
      id="finance"
      title="المالية لكل مشروع"
      description="الميزانية والمفوتر والمحصّل والمستحق والمصروفات والهامش."
      action={visible && <CsvButton section="finance" label="جدول المالية" {...financeCsv(rows, currency)} />}
    >
      {state === "restricted" && <Restricted title="التقارير المالية مقيدة" />}
      {state === "failed" && <LoadError />}
      {state === "empty" && <Empty>لا توجد بيانات مالية بعد. تظهر هنا مالية المشاريع التي أنت عضو فيها.</Empty>}
      {visible && (
        <>
          <TableScroll label="جدول المالية">
            <table className="w-full min-w-[880px] text-right text-sm" data-testid="finance-table">
              <caption className="sr-only">المالية لكل مشروع</caption>
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th scope="col" className={TH}>المشروع</th>
                  <th scope="col" className={TH}>الحالة</th>
                  <th scope="col" className={TH}>الميزانية</th>
                  <th scope="col" className={TH}>المفوتر</th>
                  <th scope="col" className={TH}>المحصّل</th>
                  <th scope="col" className={TH}>المستحق</th>
                  <th scope="col" className={TH}>المصروفات</th>
                  <th scope="col" className={TH}>الهامش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {rows.map((r) => (
                  <tr key={r.project_id}>
                    <ProjectCell id={r.project_id} name={r.name} code={r.code} tab="finance" />
                    <td className="px-2 py-2"><StatusPill status={r.status} /></td>
                    <td className={TD} data-col="budget">{r.budget == null ? "—" : formatMoney(r.budget, currency)}</td>
                    <td className={TD} data-col="invoiced">{formatMoney(r.invoiced, currency)}</td>
                    <td className={TD} data-col="paid">{formatMoney(r.paid, currency)}</td>
                    <td className={TD} data-col="outstanding">{formatMoney(r.outstanding, currency)}</td>
                    <td className={TD} data-col="expenses">{formatMoney(r.expenses, currency)}</td>
                    <td className={`${TD} ${r.margin < 0 ? "text-red-300" : "text-emerald-300"}`} data-col="margin">{formatMoney(r.margin, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 font-semibold text-white" data-testid="finance-totals">
                  <th scope="row" className="px-2 py-2 text-right">{TOTAL_LABEL}</th>
                  <td className={TD} />
                  <td className={TD} data-col="budget">{formatMoney(totals.budget, currency)}</td>
                  <td className={TD} data-col="invoiced">{formatMoney(totals.invoiced, currency)}</td>
                  <td className={TD} data-col="paid">{formatMoney(totals.paid, currency)}</td>
                  <td className={TD} data-col="outstanding">{formatMoney(totals.outstanding, currency)}</td>
                  <td className={TD} data-col="expenses">{formatMoney(totals.expenses, currency)}</td>
                  <td className={`${TD} ${totals.margin < 0 ? "text-red-300" : "text-emerald-300"}`} data-col="margin">{formatMoney(totals.margin, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </TableScroll>
          <p className="mt-3 text-xs text-slate-500">الهامش = المفوتر − المصروفات. المستحق = المفوتر − المحصّل.</p>
        </>
      )}
    </Section>
  );
}
