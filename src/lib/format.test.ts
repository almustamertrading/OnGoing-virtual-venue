import { describe, expect, it } from "vitest";
import { arabicDays, formatDate, formatDateTime, isIsoDate } from "./format";

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

describe("isIsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2027-02-28")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    // Date.parse rolls these over into the next month; they are not dates.
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("2027-04-31")).toBe(false);
    expect(isIsoDate("2027-13-01")).toBe(false);
  });

  it("rejects other formats", () => {
    for (const s of ["", "15/03/2027", "2027-3-15", "2027-03-15T10:00", " 2027-03-15", "٢٠٢٧-٠٣-١٥"]) expect(isIsoDate(s)).toBe(false);
  });
});

describe("arabicDays", () => {
  it("agrees the noun with the number", () => {
    expect([1, 2, 3, 6, 10, 11, 25, 100].map(arabicDays)).toEqual(["يوم واحد", "يومان", "3 أيام", "6 أيام", "10 أيام", "11 يومًا", "25 يومًا", "100 يومًا"]);
  });
});
