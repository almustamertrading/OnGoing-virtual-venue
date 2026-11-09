/** Money maths shared by the BOQ, proposals, the client PDF and project conversion. */

/** Rounds to 2 decimals (halalas), avoiding binary floating-point drift such as 0.1 + 0.2. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Quantity × unit price, or null when either is missing (an unpriced line). */
export function lineTotal(quantity: number | null | undefined, unitPrice: number | null | undefined): number | null {
  if (quantity == null || unitPrice == null) return null;
  return round2(Number(quantity) * Number(unitPrice));
}

/** Sum of the priced lines of a bill of quantities. */
export function boqTotal(items: { quantity: number | null; unit_price: number | null }[]): number {
  return round2(items.reduce((sum, it) => sum + (lineTotal(it.quantity, it.unit_price) ?? 0), 0));
}

export type ProposalLine = {
  quantity: number;
  unit_price: number;
  is_optional: boolean;
  /** Internal cost; only present for finance users. */
  unit_cost?: number | null;
};

export type ProposalTotals = {
  subtotal: number;
  vat: number;
  grand: number;
  cost: number;
  margin: number;
  /** Margin as a whole percentage of the subtotal (0 when there is no subtotal). */
  marginPct: number;
};

/** Totals of a proposal. Optional lines are shown to the client but not charged. */
export function proposalTotals(items: ProposalLine[], vatRate: number): ProposalTotals {
  const billable = items.filter((i) => !i.is_optional);
  const subtotal = round2(billable.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0));
  const cost = round2(billable.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost ?? 0), 0));
  const vat = round2(subtotal * (Number(vatRate) / 100));
  const margin = round2(subtotal - cost);
  return {
    subtotal,
    vat,
    grand: round2(subtotal + vat),
    cost,
    margin,
    marginPct: subtotal ? Math.round((margin / subtotal) * 100) : 0,
  };
}
