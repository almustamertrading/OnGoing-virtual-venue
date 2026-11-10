import { describe, expect, it } from "vitest";
import {
  buildFacts, extractNumbers, factDeltas, MANAGEMENT_SCHEMA, managementPrompt, mockManagementOutput, normalizeSummary, parseManagementBrief,
  ruleSuggestions, snapshotFacts, weekStart,
} from "./management";

// The shape returned by public.management_summary (see the migration), with finance access.
const raw = {
  today: "2026-11-10",
  generated_at: "2026-11-10T09:00:00Z",
  finance_access: true,
  projects: { total: 5, active: 3, in_delivery: 2 },
  tasks: {
    overdue_total: 4, blocked_total: 1, due_week_total: 6, done_week_total: 2,
    overdue_by_project: [
      { project_id: "p1", code: "2026-002", name: "Gala Dinner", count: 3, oldest_due: "2026-11-01" },
      { project_id: "p2", code: "2026-005", name: "Expo Booth", count: 1, oldest_due: "2026-11-08" },
    ],
    blocked_by_project: [{ project_id: "p1", code: "2026-002", name: "Gala Dinner", count: 1 }],
  },
  milestones: { overdue_total: 1, upcoming_total: 2, overdue: [{ project_id: "p1", code: "2026-002", name: "Gala Dinner", title: "Venue sign-off", due_date: "2026-11-05" }], upcoming: [] },
  approvals: {
    under_review_total: 2, under_review: [{ id: "q1", reference: "ONG-PRO-2026-0001", title: "Forum", since: "2026-11-02T10:00:00Z" }],
    approved_not_sent_total: 0, approved_not_sent: [],
    findings_proposed: [{ workflow: "tender", count: 5 }, { workflow: "management", count: 2 }],
    requirements_due_total: 2, requirements_due: [{ project_id: "p1", code: "2026-002", name: "Gala Dinner", title: "Bank guarantee", due_date: "2026-11-09", overdue: true }],
  },
  procurement: {
    open_total: 3, response_overdue_total: 1, near_event_total: 1,
    open: [{ rfq_id: "r1", project_id: "p1", code: "2026-002", name: "Gala Dinner", title: "Lighting", status: "sent", due_date: "2026-11-08", days_open: 12, event_start: "2026-11-20", response_overdue: true, near_event: true, priced_quotes: 2 }],
  },
  risks: { open_issues: 2, open_risks: 1, high_total: 1, high: [{ id: "k1", project_id: "p1", code: "2026-002", name: "Gala Dinner", kind: "issue", title: "Power", status: "open" }] },
  pipeline: { open_total: 4, open_value: 850000, awaiting_client_total: 1, awaiting_client_value: 300000, by_status: [] },
  finance: {
    outstanding_total: 150000, overdue_invoices_total: 1, overdue_amount: 150000,
    overdue_invoices: [{ project_id: "p1", code: "2026-002", name: "Gala Dinner", number: "INV-7", amount: 150000, due_date: "2026-10-31", days_overdue: 10 }],
    over_budget: [{ project_id: "p2", code: "2026-005", name: "Expo Booth", budget: 100000, expenses: 120000, excess: 20000 }],
    negative_margin: [],
    low_margin_proposals: [{ id: "q2", reference: "ONG-PRO-2026-0002", title: "Expo", value: 100000, margin_pct: 6.5 }],
  },
};

describe("normalizeSummary", () => {
  it("reads the database JSON into typed figures", () => {
    const s = normalizeSummary(raw);
    expect(s.tasks.overdueByProject[0]).toEqual({ projectId: "p1", code: "2026-002", name: "Gala Dinner", count: 3, oldestDue: "2026-11-01" });
    expect(s.procurement.open[0]).toMatchObject({ responseOverdue: true, nearEvent: true, pricedQuotes: 2, daysOpen: 12 });
    expect(s.finance?.lowMarginProposals[0].marginPct).toBe(6.5);
    expect(s.financeAccess).toBe(true);
  });

  it("turns missing parts into zeros and empty lists, and keeps hidden finance as null", () => {
    const s = normalizeSummary({ finance_access: false, finance: null });
    expect(s.tasks.overdueTotal).toBe(0);
    expect(s.approvals.underReview).toEqual([]);
    expect(s.finance).toBeNull();
    expect(s.financeAccess).toBe(false);
    expect(normalizeSummary(null).projects.total).toBe(0);
    // A quote count the database hid (no finance access) stays unknown, never zero.
    const hidden = normalizeSummary({ procurement: { open: [{ rfq_id: "r", priced_quotes: null }] } });
    expect(hidden.procurement.open[0].pricedQuotes).toBeNull();
  });
});

describe("buildFacts", () => {
  it("lists facts per section, with per-project overdue work and links", () => {
    const facts = buildFacts(normalizeSummary(raw));
    const byId = new Map(facts.map((f) => [f.id, f]));
    expect(byId.get("tasks.overdue")).toMatchObject({ value: 4, display: "4", kind: "fact", section: "attention" });
    expect(byId.get("tasks.overdue.2026-002")).toMatchObject({ value: 3, href: "/projects/p1/tasks", label: "المهام المتأخرة في Gala Dinner (2026-002)" });
    expect(byId.get("pipeline.open_value")?.display).toBe("SAR 850,000");
    expect(byId.get("findings.proposed.tender")?.value).toBe(5);
    expect(byId.has("findings.proposed.management")).toBe(false);
    expect(new Set(facts.map((f) => f.id)).size).toBe(facts.length);
  });

  it("marks projections as estimates and finance figures as finance-only", () => {
    const facts = buildFacts(normalizeSummary(raw), "USD");
    const lowMargin = facts.find((f) => f.id === "finance.low_margin_proposals");
    expect(lowMargin).toMatchObject({ kind: "estimate", finance: true, value: 1 });
    expect(facts.find((f) => f.id === "finance.overdue_amount")?.display).toBe("USD 150,000");
    expect(facts.filter((f) => f.kind === "estimate").map((f) => f.id)).toEqual(["finance.low_margin_proposals"]);
  });

  it("has no finance facts without finance access", () => {
    const facts = buildFacts(normalizeSummary({ ...raw, finance_access: false, finance: null }));
    expect(facts.some((f) => f.finance || f.section === "finance")).toBe(false);
  });
});

describe("ruleSuggestions", () => {
  it("puts collection, overdue work, requirements and procurement first, each citing its facts", () => {
    const suggestions = ruleSuggestions(normalizeSummary(raw));
    expect(suggestions.slice(0, 5).map((s) => s.id)).toEqual(["collect-overdue", "overdue-2026-002", "overdue-2026-005", "requirements", "rfqs"]);
    expect(suggestions[0]).toMatchObject({ tone: "critical", href: "/projects/p1/finance", factIds: ["finance.overdue_invoices", "finance.overdue_amount"] });
    expect(suggestions[0].reason).toContain("SAR 150,000");
    expect(suggestions.find((s) => s.id === "overdue-2026-002")?.tone).toBe("critical");
    expect(suggestions.find((s) => s.id === "overdue-2026-005")?.tone).toBe("warning");
    expect(suggestions.find((s) => s.id === "overdue-2026-002")?.reason).toBe("مهام متأخرة: 3، أقدم موعد فائت 1 Nov 2026.");
    expect(suggestions.find((s) => s.id === "requirements")?.reason).toContain("منها متأخرة: 1");
    const facts = new Set(buildFacts(normalizeSummary(raw)).map((f) => f.id));
    for (const s of suggestions) for (const id of s.factIds) expect(facts.has(id)).toBe(true);
  });

  it("does not count management briefs as findings to review, and labels the margin rule as an estimate", () => {
    const suggestions = ruleSuggestions(normalizeSummary(raw));
    expect(suggestions.find((s) => s.id === "findings")?.reason).toContain("5");
    expect(suggestions.find((s) => s.id === "low-margin")?.reason).toMatch(/^تقدير/);
  });

  it("suggests nothing financial without finance access, and nothing at all when all is clear", () => {
    const noFinance = ruleSuggestions(normalizeSummary({ ...raw, finance_access: false, finance: null }));
    expect(noFinance.some((s) => ["collect-overdue", "over-budget", "low-margin"].includes(s.id))).toBe(false);
    expect(ruleSuggestions(normalizeSummary({}))).toEqual([]);
  });
});

describe("extractNumbers", () => {
  it("normalises digits, separators and leading zeros", () => {
    expect(extractNumbers("SAR 150,000 و ٣ مهام بتاريخ 2026-11-05 بنسبة 6.50%")).toEqual(["150000", "3", "2026", "11", "5", "6.5"]);
    expect(extractNumbers("١٬٢٠٠ و ۴٫۵")).toEqual(["1200", "4.5"]);
    expect(extractNumbers("لا أرقام")).toEqual([]);
  });
});

describe("parseManagementBrief", () => {
  const facts = buildFacts(normalizeSummary(raw));
  const brief = (recommendations: unknown[]) => JSON.stringify({ recommendations });

  it("verifies a recommendation that cites known facts and only their numbers", () => {
    const [r] = parseManagementBrief(brief([
      { title: "حصّل الفاتورة المتأخرة", detail: "قيمتها SAR 150,000 ومتأخرة.", priority: "high", fact_ids: ["finance.overdue_amount", "finance.overdue_invoices"] },
    ]), facts);
    expect(r).toMatchObject({ verified: true, severity: "warning", data: { priority: "high", unknown_fact_ids: [], unverified_numbers: [] } });
    expect(r.excerpt).toBe("قيمة الفواتير المتأخرة: SAR 150,000 · فواتير متأخرة السداد: 1");
    expect(r.data.facts.map((f) => f.id)).toEqual(["finance.overdue_amount", "finance.overdue_invoices"]);
  });

  it("flags a number that no cited fact contains", () => {
    const [r] = parseManagementBrief(brief([
      { title: "أنجز المهام المتأخرة", detail: "لديك 7 مهام متأخرة في Gala Dinner.", priority: "medium", fact_ids: ["tasks.overdue.2026-002"] },
    ]), facts);
    expect(r.verified).toBe(false);
    expect(r.data.unverified_numbers).toEqual(["7"]);
    // The project's code is in the cited fact, so mentioning it is fine.
    const [withCode] = parseManagementBrief(brief([
      { title: "مشروع 2026-002", detail: "3 مهام متأخرة.", priority: "medium", fact_ids: ["tasks.overdue.2026-002"] },
    ]), facts);
    expect(withCode.verified).toBe(true);
  });

  it("flags unknown fact ids and recommendations that cite nothing", () => {
    const [unknown, none] = parseManagementBrief(brief([
      { title: "راجع الميزانية", detail: "", priority: "low", fact_ids: ["finance.forecast", "finance.over_budget"] },
      { title: "اجتمع بالفريق", detail: "", priority: "low", fact_ids: [] },
    ]), facts);
    expect(unknown).toMatchObject({ verified: false, data: { unknown_fact_ids: ["finance.forecast"], fact_ids: ["finance.over_budget"] } });
    expect(none.verified).toBe(false);
    expect(none.excerpt).toBe("");
  });

  it("skips empty items, defaults the priority, caps at eight, and fails clearly on non-JSON", () => {
    const parsed = parseManagementBrief(brief([
      { title: "  ", detail: "x", priority: "high", fact_ids: [] }, null, "text",
      ...Array.from({ length: 12 }, (_, i) => ({ title: `توصية ${i}`, detail: "", priority: "urgent", fact_ids: ["tasks.overdue"] })),
    ]), facts);
    expect(parsed).toHaveLength(8);
    expect(parsed[0].data.priority).toBe("medium");
    expect(() => parseManagementBrief("no json", facts)).toThrow("unparseable");
    expect(parseManagementBrief('{"recommendations": "none"}', facts)).toEqual([]);
  });
});

describe("mockManagementOutput", () => {
  it("recommends from the most urgent non-zero facts, and its output verifies", () => {
    const facts = buildFacts(normalizeSummary(raw));
    const output = mockManagementOutput(facts);
    expect(output.recommendations).toHaveLength(3);
    const parsed = parseManagementBrief(JSON.stringify(output), facts);
    expect(parsed.map((r) => r.data.fact_ids[0])).toEqual(["finance.overdue_amount", "tasks.overdue", "rfqs.near_event"]);
    expect(parsed.every((r) => r.verified)).toBe(true);
    expect(mockManagementOutput(buildFacts(normalizeSummary({}))).recommendations).toEqual([]);
  });
});

describe("schema and prompt", () => {
  it("requires every property and allows no others (structured outputs)", () => {
    const item = MANAGEMENT_SCHEMA.properties.recommendations.items;
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort());
    expect(item.additionalProperties).toBe(false);
  });

  it("fences the facts as data, one per line with id, kind, label and value", () => {
    const facts = buildFacts(normalizeSummary(raw));
    const prompt = managementPrompt(facts, "2026-11-10");
    expect(prompt).toContain("Today: 2026-11-10");
    expect(prompt).toContain("finance.low_margin_proposals | estimate | عروض مفتوحة بهامش متوقع أقل من 10% | 1");
    expect(prompt.trim().endsWith("===== END OF FACTS =====")).toBe(true);
  });
});

describe("weekly snapshots", () => {
  it("starts weeks on Sunday", () => {
    expect(weekStart("2026-11-10")).toBe("2026-11-08"); // Tuesday
    expect(weekStart("2026-11-08")).toBe("2026-11-08"); // Sunday
    expect(weekStart("2026-11-14")).toBe("2026-11-08"); // Saturday
    expect(weekStart("2027-01-01")).toBe("2026-12-27"); // across a year
  });

  it("stores every fact but the finance ones", () => {
    const snap = snapshotFacts(buildFacts(normalizeSummary(raw)));
    expect(snap["tasks.overdue"]).toBe(4);
    expect(snap["tasks.overdue.2026-002"]).toBe(3);
    expect(Object.keys(snap).some((k) => k.startsWith("finance."))).toBe(false);
  });

  it("computes the change per fact against the previous snapshot, finance excluded", () => {
    const facts = buildFacts(normalizeSummary(raw));
    const deltas = factDeltas(facts, { "tasks.overdue": 1, "pipeline.open_value": 900000, "finance.overdue_amount": 1, "risks.high": "x" });
    expect(deltas["tasks.overdue"]).toEqual({ previous: 1, delta: 3 });
    expect(deltas["pipeline.open_value"]).toEqual({ previous: 900000, delta: -50000 });
    expect(deltas["finance.overdue_amount"]).toBeUndefined();
    expect(deltas["risks.high"]).toBeUndefined();
    expect(factDeltas(facts, null)).toEqual({});
  });

  it("knows which way is better for each fact", () => {
    const byId = new Map(buildFacts(normalizeSummary(raw)).map((f) => [f.id, f.better]));
    expect(byId.get("tasks.overdue")).toBe("down");
    expect(byId.get("tasks.overdue.2026-002")).toBe("down");
    expect(byId.get("tasks.done_week")).toBe("up");
    expect(byId.get("pipeline.open_value")).toBe("up");
    expect(byId.get("rfqs.open")).toBeNull();
  });
});
