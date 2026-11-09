import { describe, expect, it } from "vitest";
import { boqTotal, lineTotal, proposalTotals, round2 } from "./money";

describe("round2", () => {
  it("removes floating-point drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });
});

describe("lineTotal", () => {
  it("multiplies quantity by unit price", () => {
    expect(lineTotal(3, 250.5)).toBe(751.5);
  });
  it("is null for an unpriced line", () => {
    expect(lineTotal(3, null)).toBeNull();
    expect(lineTotal(null, 10)).toBeNull();
  });
  it("keeps zero as a real price", () => {
    expect(lineTotal(5, 0)).toBe(0);
  });
});

describe("boqTotal", () => {
  it("sums priced lines and skips unpriced ones", () => {
    expect(
      boqTotal([
        { quantity: 2, unit_price: 100 },
        { quantity: 1, unit_price: null },
        { quantity: 4, unit_price: 12.25 },
      ]),
    ).toBe(249);
  });
  it("is 0 for an empty BOQ", () => {
    expect(boqTotal([])).toBe(0);
  });
});

describe("proposalTotals", () => {
  const items = [
    { quantity: 1, unit_price: 180, unit_cost: 100, is_optional: false },
    { quantity: 2, unit_price: 400, unit_cost: 250.5, is_optional: false },
    { quantity: 1, unit_price: 999, unit_cost: 500, is_optional: true },
  ];

  it("charges only non-optional lines and adds VAT", () => {
    const t = proposalTotals(items, 15);
    expect(t.subtotal).toBe(980);
    expect(t.vat).toBe(147);
    expect(t.grand).toBe(1127);
  });

  it("computes internal cost and margin from billable lines", () => {
    const t = proposalTotals(items, 15);
    expect(t.cost).toBe(601);
    expect(t.margin).toBe(379);
    expect(t.marginPct).toBe(39);
  });

  it("treats missing costs (non-finance users) as zero without failing", () => {
    const t = proposalTotals([{ quantity: 2, unit_price: 50, is_optional: false }], 15);
    expect(t.cost).toBe(0);
    expect(t.subtotal).toBe(100);
  });

  it("handles an empty proposal", () => {
    expect(proposalTotals([], 15)).toEqual({ subtotal: 0, vat: 0, grand: 0, cost: 0, margin: 0, marginPct: 0 });
  });

  it("reports a negative margin when selling below cost", () => {
    const t = proposalTotals([{ quantity: 1, unit_price: 80, unit_cost: 100, is_optional: false }], 0);
    expect(t.margin).toBe(-20);
    expect(t.marginPct).toBe(-25);
  });
});
