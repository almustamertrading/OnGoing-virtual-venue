import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

describe("formatDate", () => {
  it("formats an ISO date without time zone shifts", () => {
    expect(formatDate("2027-03-01")).toBe("1 Mar 2027");
    expect(formatDate(null)).toBe("");
  });
});

describe("formatDateTime", () => {
  it("shows timestamps in Riyadh time, crossing midnight correctly", () => {
    expect(formatDateTime("2026-11-09T21:05:00Z")).toBe("10 Nov 2026, 00:05");
    expect(formatDateTime("2026-09-01T09:30:00+03:00")).toBe("1 Sep 2026, 09:30");
  });

  it("returns an empty string for missing or invalid input", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime("not a date")).toBe("");
  });
});
