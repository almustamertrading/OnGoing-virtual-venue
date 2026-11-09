import { describe, expect, it } from "vitest";
import {
  CSV_BOM,
  RESTRICTED_LABEL,
  barPathRtl,
  barScale,
  buildCsv,
  csvCell,
  csvFileName,
  deliveryCsv,
  financeCsv,
  financeTotals,
  formatCompactMoney,
  formatPercent,
  normalizeFinance,
  normalizePipeline,
  normalizeProcurement,
  pipelineByStatus,
  pipelineCsv,
  pipelineTotals,
  procurementCsv,
  procurementTotals,
  projectStatusLabel,
  proposalTotals,
  proposalsByStatus,
  ratio,
  reportSummary,
  sortDelivery,
  sum,
  winRate,
} from "./reports";
import type {
  ReportDeliveryRow,
  ReportPipelineRow,
  ReportProcurementRow,
  ReportProjectFinanceRow,
  ReportProposalsRow,
} from "./types";

const proposals = (counts: Partial<Record<ReportProposalsRow["status"], number>>): ReportProposalsRow[] =>
  Object.entries(counts).map(([status, n]) => ({ status: status as ReportProposalsRow["status"], proposals: n ?? 0, value_total: 0 }));

const financeRow = (over: Partial<ReportProjectFinanceRow>): ReportProjectFinanceRow => ({
  project_id: "p1", code: "ONG-1", name: "Gala", status: "confirmed", budget: 500000,
  invoiced: 150000, paid: 0, outstanding: 150000, expenses: 90000, margin: 60000, ...over,
});

const deliveryRow = (over: Partial<ReportDeliveryRow>): ReportDeliveryRow => ({
  project_id: "p1", code: "ONG-1", name: "Gala", status: "confirmed", tasks_total: 0, tasks_done: 0,
  tasks_overdue: 0, tasks_blocked: 0, milestones_total: 0, milestones_done: 0, next_milestone: null, ...over,
});

const procurementRow = (over: Partial<ReportProcurementRow>): ReportProcurementRow => ({
  project_id: "p1", code: "ONG-1", name: "Gala", rfqs: 1, rfqs_awarded: 0, quotes: 1, awarded_value: 0, ...over,
});

describe("csvCell", () => {
  it("leaves plain text and Arabic alone", () => {
    expect(csvCell("QA Gala Dinner")).toBe("QA Gala Dinner");
    expect(csvCell("مؤكد")).toBe("مؤكد");
  });

  it("quotes fields with commas, quotes or line breaks and doubles inner quotes", () => {
    expect(csvCell("Hall A, B")).toBe('"Hall A, B"');
    expect(csvCell('The "Grand" Hall')).toBe('"The ""Grand"" Hall"');
    expect(csvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvCell("line 1\r\nline 2")).toBe('"line 1\r\nline 2"');
  });

  it("writes empty cells for null and undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("writes numbers as they are, negative amounts included", () => {
    expect(csvCell(150000)).toBe("150000");
    expect(csvCell(-5000.5)).toBe("-5000.5");
    expect(csvCell(0)).toBe("0");
  });

  it("writes nothing for non-finite numbers", () => {
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(Number.POSITIVE_INFINITY)).toBe("");
  });

  it.each([
    ["=HYPERLINK(\"http://evil.test\")", "\"'=HYPERLINK(\"\"http://evil.test\"\")\""],
    ["+1+1", "'+1+1"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1:A2)", "'@SUM(A1:A2)"],
    ["\tcmd", "'\tcmd"],
    ["\rcmd", "\"'\rcmd\""],
  ])("neutralises formula injection in %j", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it("neutralises a text cell that looks like a negative number, but not a real number", () => {
    expect(csvCell("-5000")).toBe("'-5000");
    expect(csvCell(-5000)).toBe("-5000");
  });

  it("only checks the first character", () => {
    expect(csvCell("Budget = 5")).toBe("Budget = 5");
    expect(csvCell("a@b.test")).toBe("a@b.test");
  });
});

describe("buildCsv", () => {
  const csv = buildCsv(["الحالة", "القيمة"], [["مؤكد", 500000], ["=1+1", -20], ['Say "hi", then\nleave', null]]);

  it("starts with the UTF-8 byte order mark", () => {
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(CSV_BOM).toBe("﻿");
    // Encoded, the BOM is the three bytes Excel looks for.
    expect([...new TextEncoder().encode(csv).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("writes the header row first and CRLF line endings", () => {
    expect(csv).toBe(
      `${CSV_BOM}الحالة,القيمة\r\nمؤكد,500000\r\n'=1+1,-20\r\n"Say ""hi"", then\nleave",\r\n`,
    );
  });

  it("handles a header with no rows", () => {
    expect(buildCsv(["a", "b"], [])).toBe(`${CSV_BOM}a,b\r\n`);
  });
});

describe("csvFileName", () => {
  it("names the file after the section and the date", () => {
    expect(csvFileName("pipeline", "2026-11-09")).toBe("ongoing-pipeline-2026-11-09.csv");
  });
  it("makes the section safe for a file name", () => {
    expect(csvFileName("Project Finance/../x", "2026-11-09")).toBe("ongoing-project-finance-x-2026-11-09.csv");
    expect(csvFileName("مالية", "2026-11-09")).toBe("ongoing-report-2026-11-09.csv");
  });
  it("leaves out a malformed date", () => {
    expect(csvFileName("delivery", "9/11/2026")).toBe("ongoing-delivery.csv");
  });
});

describe("winRate", () => {
  it("is (accepted + converted) / (accepted + converted + rejected)", () => {
    expect(winRate(proposals({ accepted: 1, converted: 2, rejected: 1 }))).toBe(0.75);
    expect(winRate(proposals({ accepted: 1, rejected: 1 }))).toBe(0.5);
  });
  it("ignores proposals that are not decided yet", () => {
    expect(winRate(proposals({ draft: 9, sent_to_client: 4, expired: 3, accepted: 1, rejected: 3 }))).toBe(0.25);
  });
  it("is null when nothing is decided (no division by zero)", () => {
    expect(winRate([])).toBeNull();
    expect(winRate(proposals({ draft: 3, under_review: 2 }))).toBeNull();
  });
  it("is 0 when every decided proposal was lost and 1 when every one was won", () => {
    expect(winRate(proposals({ rejected: 2 }))).toBe(0);
    expect(winRate(proposals({ converted: 2 }))).toBe(1);
  });
  it("is shown as a whole percentage, or a dash", () => {
    expect(formatPercent(winRate(proposals({ accepted: 1, rejected: 2 })))).toBe("33%");
    expect(formatPercent(0.666)).toBe("67%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("ratio and sum", () => {
  it("guards against zero, negative and non-finite denominators", () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(1, -2)).toBeNull();
    expect(ratio(1, Number.NaN)).toBeNull();
    expect(ratio(3, 4)).toBe(0.75);
  });
  it("sums finite values and skips null", () => {
    expect(sum([1, null, 2, undefined, Number.NaN, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });
});

describe("barScale", () => {
  it("scales lengths to the largest value", () => {
    expect(barScale([50, 100, 25], 200)).toEqual([100, 200, 50]);
  });
  it("draws no bar for zero", () => {
    expect(barScale([0, 10], 100)).toEqual([0, 100]);
  });
  it("is safe when every value is zero (no division by zero)", () => {
    expect(barScale([0, 0, 0], 100)).toEqual([0, 0, 0]);
  });
  it("draws no bar for negative or non-finite values", () => {
    expect(barScale([-50, 100], 100)).toEqual([0, 100]);
    expect(barScale([-5, -10], 100)).toEqual([0, 0]);
    expect(barScale([Number.NaN, Number.POSITIVE_INFINITY, 4], 100)).toEqual([0, 0, 100]);
  });
  it("returns nothing for no values, and no bars for an empty or invalid track", () => {
    expect(barScale([], 100)).toEqual([]);
    expect(barScale([1, 2], 0)).toEqual([0, 0]);
    expect(barScale([1, 2], -10)).toEqual([0, 0]);
    expect(barScale([1, 2], Number.NaN)).toEqual([0, 0]);
  });
  it("keeps a tiny positive value visible, within the track", () => {
    expect(barScale([1, 100000], 100)).toEqual([2, 100]);
    expect(barScale([1, 100000], 100, 6)).toEqual([6, 100]);
    expect(barScale([1, 2], 1, 6)).toEqual([1, 1]);
  });
});

describe("barPathRtl", () => {
  it("is square at the baseline and rounded at the data end", () => {
    expect(barPathRtl(100, 10, 50, 14, 4)).toBe("M100,10H54A4,4 0 0 0 50,14V20A4,4 0 0 0 54,24H100Z");
  });
  it("shrinks the radius for a short bar", () => {
    expect(barPathRtl(100, 0, 2, 14, 4)).toBe("M100,0H100A2,2 0 0 0 98,2V12A2,2 0 0 0 100,14H100Z");
  });
  it("is empty for a zero, negative or invalid length", () => {
    expect(barPathRtl(100, 0, 0, 14)).toBe("");
    expect(barPathRtl(100, 0, -5, 14)).toBe("");
    expect(barPathRtl(100, 0, Number.NaN, 14)).toBe("");
  });
});

describe("totals", () => {
  it("adds up the pipeline", () => {
    const rows: ReportPipelineRow[] = [
      { status: "lead", projects: 2, budget_total: 100000 },
      { status: "confirmed", projects: 1, budget_total: 500000 },
    ];
    expect(pipelineTotals(rows)).toEqual({ projects: 3, budget: 600000 });
  });

  it("adds up proposals", () => {
    expect(proposalTotals([
      { status: "draft", proposals: 2, value_total: 60000 },
      { status: "accepted", proposals: 1, value_total: 40000 },
    ])).toEqual({ proposals: 3, value: 100000 });
  });

  it("adds up finance per project, skipping a missing budget", () => {
    const rows = [
      financeRow({}),
      financeRow({ project_id: "p2", budget: null, invoiced: 20000, paid: 20000, outstanding: 0, expenses: 30000, margin: -10000 }),
    ];
    expect(financeTotals(rows)).toEqual({
      budget: 500000, invoiced: 170000, paid: 20000, outstanding: 150000, expenses: 120000, margin: 50000,
    });
    expect(financeTotals([])).toEqual({ budget: 0, invoiced: 0, paid: 0, outstanding: 0, expenses: 0, margin: 0 });
  });

  it("never counts withheld quote figures as zero", () => {
    const withheld = [procurementRow({ quotes: null, awarded_value: null }), procurementRow({ project_id: "p2", rfqs: 2, quotes: null, awarded_value: null })];
    expect(procurementTotals(withheld)).toEqual({ rfqs: 3, rfqsAwarded: 0, quotes: null, awardedValue: null, partial: false });

    const mixed = [procurementRow({ quotes: 3, awarded_value: 42000, rfqs_awarded: 1 }), procurementRow({ project_id: "p2", quotes: null, awarded_value: null })];
    expect(procurementTotals(mixed)).toEqual({ rfqs: 2, rfqsAwarded: 1, quotes: 3, awardedValue: 42000, partial: true });

    expect(procurementTotals([])).toEqual({ rfqs: 0, rfqsAwarded: 0, quotes: 0, awardedValue: 0, partial: false });
  });
});

describe("reportSummary", () => {
  it("counts active projects and their budgets, the win rate, overdue tasks and receivables", () => {
    const summary = reportSummary({
      pipeline: [
        { status: "lead", projects: 2, budget_total: 100000 },
        { status: "in_progress", projects: 1, budget_total: 300000 },
        { status: "completed", projects: 4, budget_total: 900000 },
        { status: "cancelled", projects: 1, budget_total: 50000 },
      ],
      proposals: proposals({ accepted: 1, rejected: 1, draft: 5 }),
      delivery: [deliveryRow({ tasks_overdue: 2 }), deliveryRow({ project_id: "p2", tasks_overdue: 3 })],
      finance: [financeRow({}), financeRow({ project_id: "p2", outstanding: 25000 })],
    });
    expect(summary).toEqual({ activeProjects: 3, pipelineValue: 400000, winRate: 0.5, overdueTasks: 5, outstanding: 175000 });
  });

  it("is all zeros (and no win rate) for an empty organisation", () => {
    expect(reportSummary({ pipeline: [], proposals: [], delivery: [], finance: [] })).toEqual({
      activeProjects: 0, pipelineValue: 0, winRate: null, overdueTasks: 0, outstanding: 0,
    });
  });
});

describe("ordering", () => {
  it("lists every project status in lifecycle order, with zeros", () => {
    const rows = pipelineByStatus([{ status: "confirmed", projects: 1, budget_total: 500000 }]);
    expect(rows.map((r) => r.status)).toEqual(["lead", "proposal", "confirmed", "in_progress", "completed", "on_hold", "cancelled"]);
    expect(rows[2]).toEqual({ status: "confirmed", projects: 1, budget_total: 500000 });
    expect(rows[0]).toEqual({ status: "lead", projects: 0, budget_total: 0 });
  });

  it("keeps a status it does not know yet, so the totals still match", () => {
    const future = { status: "archived" as ReportPipelineRow["status"], projects: 2, budget_total: 7000 };
    const rows = pipelineByStatus([{ status: "lead", projects: 1, budget_total: 1000 }, future]);
    expect(rows).toHaveLength(8);
    expect(rows.at(-1)).toEqual(future);
    expect(pipelineTotals(rows)).toEqual({ projects: 3, budget: 8000 });
    expect(projectStatusLabel(future.status)).toBe("archived");
    expect(projectStatusLabel("in_progress")).toBe("قيد التنفيذ");
  });

  it("orders proposal statuses by lifecycle and drops empty ones", () => {
    const rows = proposalsByStatus(proposals({ rejected: 1, draft: 2, accepted: 1, expired: 0 }));
    expect(rows.map((r) => r.status)).toEqual(["draft", "accepted", "rejected"]);
  });

  it("puts overdue, then blocked, delivery first", () => {
    const rows = sortDelivery([
      deliveryRow({ project_id: "a", name: "Alpha" }),
      deliveryRow({ project_id: "b", name: "Beta", tasks_blocked: 1 }),
      deliveryRow({ project_id: "c", name: "Gamma", tasks_overdue: 2 }),
    ]);
    expect(rows.map((r) => r.project_id)).toEqual(["c", "b", "a"]);
  });
});

describe("normalising RPC rows", () => {
  it("turns numeric strings into numbers", () => {
    expect(normalizePipeline([{ status: "lead", projects: "2", budget_total: "1500.50" }])).toEqual([
      { status: "lead", projects: 2, budget_total: 1500.5 },
    ]);
    expect(normalizeFinance([{ project_id: "p", code: "C", name: "N", status: "lead", budget: null, invoiced: "10", paid: 0, outstanding: 10, expenses: 0, margin: 10 }])[0].budget).toBeNull();
  });

  it("treats anything but an array as no rows", () => {
    expect(normalizePipeline(null)).toEqual([]);
    expect(normalizePipeline({ status: "lead" })).toEqual([]);
  });

  it("keeps quote figures withheld without finance access", () => {
    const data = [{ project_id: "p", code: "C", name: "N", rfqs: 1, rfqs_awarded: 0, quotes: 2, awarded_value: 100 }];
    expect(normalizeProcurement(data, true)[0]).toMatchObject({ quotes: 2, awarded_value: 100 });
    expect(normalizeProcurement(data, false)[0]).toMatchObject({ quotes: null, awarded_value: null });
    expect(normalizeProcurement([{ ...data[0], quotes: null, awarded_value: null }], true)[0]).toMatchObject({ quotes: null, awarded_value: null });
  });
});

describe("CSV tables", () => {
  it("exports the pipeline with Arabic statuses, raw amounts and a total", () => {
    const table = pipelineCsv(pipelineByStatus([{ status: "confirmed", projects: 1, budget_total: 500000 }]), "SAR");
    expect(table.header).toEqual(["الحالة", "عدد المشاريع", "إجمالي الميزانيات (SAR)"]);
    expect(table.rows).toContainEqual(["مؤكد", 1, 500000]);
    expect(table.rows.at(-1)).toEqual(["الإجمالي", 1, 500000]);
  });

  it("exports withheld procurement figures as restricted, not as zero", () => {
    const table = procurementCsv([procurementRow({ quotes: null, awarded_value: null })], "SAR");
    expect(table.rows[0]).toEqual(["ONG-1", "Gala", 1, 0, RESTRICTED_LABEL, RESTRICTED_LABEL]);
    expect(table.rows[1]).toEqual(["", "الإجمالي", 1, 0, RESTRICTED_LABEL, RESTRICTED_LABEL]);
  });

  it("exports finance with totals", () => {
    const table = financeCsv([financeRow({})], "SAR");
    expect(table.rows[0]).toEqual(["ONG-1", "Gala", "مؤكد", 500000, 150000, 0, 150000, 90000, 60000]);
    expect(table.rows[1]).toEqual(["", "الإجمالي", "", 500000, 150000, 0, 150000, 90000, 60000]);
  });

  it("exports delivery with a completion percentage, blank when there are no tasks", () => {
    const table = deliveryCsv([
      deliveryRow({ tasks_total: 3, tasks_done: 1, tasks_overdue: 1, next_milestone: "2099-06-01" }),
      deliveryRow({ project_id: "p2", name: "Empty" }),
    ]);
    expect(table.rows[0]).toEqual(["ONG-1", "Gala", "مؤكد", 3, 1, 33, 1, 0, 0, 0, "2099-06-01"]);
    expect(table.rows[1][5]).toBe("");
  });

  it("neutralises a malicious project name end to end", () => {
    const table = financeCsv([financeRow({ name: "=cmd|' /C calc'!A0" })], "SAR");
    expect(buildCsv(table.header, table.rows)).toContain("\r\nONG-1,'=cmd|' /C calc'!A0,");
  });
});

describe("formatCompactMoney", () => {
  it("shortens large amounts for chart labels", () => {
    expect(formatCompactMoney(500000)).toBe("SAR 500K");
    expect(formatCompactMoney(1250000, "USD")).toBe("USD 1.3M");
    expect(formatCompactMoney(0)).toBe("SAR 0");
  });
});
