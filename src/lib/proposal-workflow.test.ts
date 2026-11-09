import { describe, expect, it } from "vitest";
import { canConvert, isEditable, nextMoves, reviewedVersion } from "./proposal-workflow";
import type { ProposalStatus } from "./types";

const sales = { sales: true, manager: false };
const manager = { sales: false, manager: true };
const viewer = { sales: false, manager: false };
const targets = (status: ProposalStatus, who = sales) => nextMoves(status, who).map((m) => m.to);

describe("isEditable", () => {
  it("allows editing only while drafting or revising", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("ai_generated")).toBe(true);
    expect(isEditable("changes_requested")).toBe(true);
    for (const s of ["under_review", "approved_internally", "sent_to_client", "accepted", "converted"] as const) {
      expect(isEditable(s)).toBe(false);
    }
  });
});

describe("nextMoves", () => {
  it("offers submission from every editing state, with a confirmation", () => {
    for (const s of ["draft", "ai_generated", "changes_requested"] as const) {
      expect(targets(s)).toEqual(["under_review"]);
      expect(nextMoves(s, sales)[0].confirm).toBeTruthy();
    }
  });

  it("never offers approval as a plain move (approval goes through a review)", () => {
    const all: ProposalStatus[] = ["draft", "ai_generated", "under_review", "changes_requested", "approved_internally",
      "sent_to_client", "awaiting_response", "accepted", "rejected", "expired", "converted"];
    for (const s of all) {
      expect(targets(s, sales)).not.toContain("approved_internally");
      expect(targets(s, manager)).not.toContain("approved_internally");
    }
  });

  it("offers sending only after internal approval", () => {
    expect(targets("approved_internally")).toContain("sent_to_client");
    expect(targets("under_review")).not.toContain("sent_to_client");
    expect(targets("draft")).not.toContain("sent_to_client");
  });

  it("warns that reopening an approved proposal cancels the approval", () => {
    const reopen = nextMoves("approved_internally", sales).find((m) => m.to === "draft");
    expect(reopen?.confirm).toContain("الاعتماد");
  });

  it("offers client outcomes after sending, and nothing once converted", () => {
    expect(targets("sent_to_client")).toEqual(["awaiting_response", "accepted", "rejected", "draft"]);
    expect(targets("awaiting_response")).toEqual(["accepted", "rejected", "expired", "draft"]);
    expect(targets("converted")).toEqual([]);
  });

  it("offers nothing to someone without sales access or a manager role", () => {
    expect(nextMoves("draft", viewer)).toEqual([]);
    expect(nextMoves("approved_internally", viewer)).toEqual([]);
  });
});

describe("canConvert", () => {
  it("needs an approved or client-side status, no linked project, and the right role", () => {
    expect(canConvert("accepted", false, sales)).toBe(true);
    expect(canConvert("approved_internally", false, manager)).toBe(true);
    expect(canConvert("draft", false, sales)).toBe(false);
    expect(canConvert("accepted", true, sales)).toBe(false);
    expect(canConvert("accepted", false, viewer)).toBe(false);
  });
});

describe("reviewedVersion", () => {
  it("is the version frozen at submission", () => {
    expect(reviewedVersion(3)).toBe(2);
    expect(reviewedVersion(1)).toBe(1);
  });
});
