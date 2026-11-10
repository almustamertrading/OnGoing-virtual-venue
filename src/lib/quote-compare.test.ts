import { describe, expect, it } from "vitest";
import { addDays, compareQuotes, type CompareQuote } from "./quote-compare";

const base: Omit<CompareQuote, "id" | "supplier" | "amount"> = {
  status: "received", scope_basis: "supply_install", exclusions: "", valid_until: "2026-12-31", lead_time_days: 10, payment_terms: "30/70",
};
const ctx = { today: "2026-11-10", eventStart: "2026-12-01" };

describe("compareQuotes", () => {
  it("marks the lowest price and how far the others are above it", () => {
    const r = compareQuotes([
      { ...base, id: "a", supplier: "A", amount: 50000 },
      { ...base, id: "b", supplier: "B", amount: 40000 },
    ], ctx);
    expect(r.rows.find((x) => x.quote.id === "b")!.lowest).toBe(true);
    expect(r.rows.find((x) => x.quote.id === "a")!.abovePct).toBe(25);
    expect(r.recommendation.quoteId).toBe("b");
    expect(r.recommendation.reasons[0]).toContain("20%");
  });

  it("flags expired or soon-expiring validity, late delivery and missing information", () => {
    const r = compareQuotes([
      { ...base, id: "x", supplier: "X", amount: 1, valid_until: "2026-11-01" },
      { ...base, id: "y", supplier: "Y", amount: 2, valid_until: "2026-11-14" },
      { ...base, id: "z", supplier: "Z", amount: 3, lead_time_days: 40 },
      { ...base, id: "w", supplier: "W", amount: null, valid_until: null, lead_time_days: null, payment_terms: "", scope_basis: "unspecified", exclusions: "power" },
    ], ctx);
    const codes = (id: string) => r.rows.find((x) => x.quote.id === id)!.flags.map((f) => f.code);
    expect(codes("x")).toContain("expired");
    expect(codes("y")).toContain("expires_soon");
    expect(codes("z")).toContain("late_delivery");
    expect(codes("w")).toEqual(expect.arrayContaining(["missing_price", "missing_validity", "missing_lead_time", "unspecified_scope", "missing_terms", "exclusions"]));
  });

  it("never recommends a quote with a critical issue, and says why the cheapest was set aside", () => {
    const r = compareQuotes([
      { ...base, id: "cheap", supplier: "Cheap", amount: 10, valid_until: "2026-11-01" },
      { ...base, id: "ok", supplier: "OK", amount: 20 },
    ], ctx);
    expect(r.recommendation.quoteId).toBe("ok");
    expect(r.recommendation.reasons.join(" ")).toContain("Cheap");
  });

  it("gives no recommendation when nothing qualifies", () => {
    const r = compareQuotes([{ ...base, id: "x", supplier: "X", amount: null }], ctx);
    expect(r.recommendation.quoteId).toBeNull();
    expect(compareQuotes([], ctx).recommendation.reasons[0]).toContain("لا توجد عروض");
  });

  it("warns when quotes are priced on different bases", () => {
    const r = compareQuotes([
      { ...base, id: "a", supplier: "A", amount: 10, scope_basis: "supply_only" },
      { ...base, id: "b", supplier: "B", amount: 12, scope_basis: "supply_install" },
    ], ctx);
    expect(r.likeForLike).toBe(false);
    expect(r.notes[0]).toContain("ليست على أساس واحد");
    expect(r.recommendation.caveats).toContain("العروض ليست على أساس واحد.");
  });

  it("lists rejected quotes without flags and never recommends them", () => {
    const r = compareQuotes([
      { ...base, id: "r", supplier: "R", amount: 1, status: "rejected" },
      { ...base, id: "k", supplier: "K", amount: 5 },
    ], ctx);
    expect(r.rows.find((x) => x.quote.id === "r")!.flags).toEqual([]);
    expect(r.recommendation.quoteId).toBe("k");
  });

  it("computes delivery dates", () => {
    expect(addDays("2026-11-10", 21)).toBe("2026-12-01");
  });
});
