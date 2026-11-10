import { describe, expect, it } from "vitest";
import { complianceSummary, mockTenderOutput, parseTenderFindings, REGISTER_KINDS, TENDER_SCHEMA } from "./tender";

const pages = [
  "General conditions of the event tender.",
  "Bidders must submit a valid commercial registration certificate. The submission deadline is 2027-03-15 at noon.",
  "A bid bond of 2% of the offer value is required. The closing date is 2027-03-20.",
];

describe("parseTenderFindings", () => {
  const answer = JSON.stringify({
    findings: [
      { kind: "mandatory_document", title: "Commercial registration", detail: "Valid copy", severity: "critical", page: 2,
        excerpt: "submit a valid commercial registration certificate", category: "certificate", due_date: "", mandatory: true },
      { kind: "bond", title: "Bid bond 2%", detail: "", severity: "critical", page: 2,
        excerpt: "A bid bond of 2% of the offer value is required", category: "", due_date: "", mandatory: true },
      { kind: "deadline", title: "Submission deadline", detail: "", severity: "critical", page: 2,
        excerpt: "The submission deadline is 2027-03-15 at noon", category: "deadline", due_date: "2027-03-15", mandatory: true },
      { kind: "insurance", title: "Insurance", detail: "", severity: "warning", page: 1,
        excerpt: "Public liability insurance is mandatory", category: "insurance", due_date: "15/03/2027", mandatory: false },
      { kind: "made_up_kind", title: "Ignored", detail: "", severity: "info", page: 1, excerpt: "", category: "", due_date: "", mandatory: true },
      { kind: "requirement", title: "   ", detail: "", severity: "info", page: 1, excerpt: "", category: "", due_date: "", mandatory: true },
    ],
  });
  const findings = parseTenderFindings(answer, pages);

  it("keeps known kinds with a title", () => {
    expect(findings.map((f) => f.kind)).toEqual(["mandatory_document", "bond", "deadline", "insurance"]);
  });

  it("verifies each excerpt against the page text, correcting a wrong page", () => {
    expect(findings[0]).toMatchObject({ page: 2, verified: true });
    expect(findings[1]).toMatchObject({ page: 3, verified: true, data: { page_corrected: true } });
    expect(findings[3]).toMatchObject({ verified: false });
  });

  it("uses the kind's default category and keeps only real ISO dates", () => {
    expect(findings[1].data.category).toBe("bond");
    expect(findings[2].data.due_date).toBe("2027-03-15");
    expect(findings[3].data.due_date).toBe("");
    expect(findings[3].data.mandatory).toBe(false);
  });

  it("refuses an answer that is not JSON", () => {
    expect(() => parseTenderFindings("no json", pages)).toThrow();
  });

  it("matches the structured-output schema the provider is given", () => {
    expect(TENDER_SCHEMA.required).toEqual(["findings"]);
    expect(TENDER_SCHEMA.properties.findings.items.additionalProperties).toBe(false);
  });
});

describe("mockTenderOutput", () => {
  it("builds findings from the document's own sentences, so their sources verify", () => {
    const out = mockTenderOutput(pages);
    const parsed = parseTenderFindings(JSON.stringify(out), pages);
    expect(parsed.some((f) => f.kind === "mandatory_document")).toBe(true);
    expect(parsed.some((f) => f.kind === "bond")).toBe(true);
    expect(parsed.filter((f) => f.kind !== "contradiction" && f.kind !== "clarification").every((f) => f.verified)).toBe(true);
  });

  it("reports conflicting deadlines and drafts a clarification question", () => {
    const parsed = parseTenderFindings(JSON.stringify(mockTenderOutput(pages)), pages);
    expect(parsed.some((f) => f.kind === "contradiction")).toBe(true);
    expect(parsed.some((f) => f.kind === "clarification")).toBe(true);
  });
});

describe("register", () => {
  it("knows which kinds become register rows", () => {
    expect(REGISTER_KINDS.has("bond")).toBe(true);
    expect(REGISTER_KINDS.has("clarification")).toBe(false);
  });

  it("computes compliance, missing evidence and overdue items", () => {
    const rows = [
      { mandatory: true, status: "met" as const, document_id: "d1", due_date: "2027-01-01" },
      { mandatory: true, status: "open" as const, document_id: null, due_date: "2026-01-01" },
      { mandatory: false, status: "in_progress" as const, document_id: null, due_date: null },
      { mandatory: true, status: "not_applicable" as const, document_id: null, due_date: "2026-01-01" },
    ];
    expect(complianceSummary(rows, "2026-11-10")).toEqual({
      total: 4, mandatory: 2, mandatoryMet: 1, percent: 50, missingEvidence: 2, overdue: 1,
    });
    expect(complianceSummary([], "2026-11-10").percent).toBe(0);
  });
});
