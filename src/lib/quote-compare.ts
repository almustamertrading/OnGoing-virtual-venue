import type { QuoteStatus } from "./types";

// Like-for-like supplier quote comparison (Workflow D). Pure: facts in, flags and a labelled recommendation
// out. It never awards anything; a person does, with a reason, through award_quote.

export type ScopeBasis = "unspecified" | "supply_only" | "supply_install" | "service" | "rental";

export const SCOPE_BASIS_LABEL: Record<ScopeBasis, string> = {
  unspecified: "غير محدد",
  supply_only: "توريد فقط",
  supply_install: "توريد وتركيب",
  service: "خدمة",
  rental: "تأجير",
};

export type CompareQuote = {
  id: string;
  supplier: string;
  amount: number | null;
  status: QuoteStatus;
  scope_basis: ScopeBasis;
  exclusions: string;
  valid_until: string | null;
  lead_time_days: number | null;
  payment_terms: string;
};

export type QuoteFlag = { code: string; severity: "critical" | "warning" | "info"; message: string };

export type ComparedQuote = {
  quote: CompareQuote;
  flags: QuoteFlag[];
  lowest: boolean;
  /** Percent above the lowest complete price (null without a price or when it is the lowest). */
  abovePct: number | null;
  /** today + lead time, when the lead time is known. */
  deliveryDate: string | null;
};

export type Recommendation = { quoteId: string | null; reasons: string[]; caveats: string[] };

export type QuoteComparison = {
  rows: ComparedQuote[];
  likeForLike: boolean;
  notes: string[];
  recommendation: Recommendation;
};

const DAY = 24 * 60 * 60 * 1000;
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY);
}

function flagsFor(q: CompareQuote, today: string, eventStart: string | null): QuoteFlag[] {
  const flags: QuoteFlag[] = [];
  if (q.amount === null) flags.push({ code: "missing_price", severity: "critical", message: "بلا سعر" });
  if (q.valid_until === null) {
    flags.push({ code: "missing_validity", severity: "warning", message: "صلاحية العرض غير مذكورة" });
  } else if (q.valid_until < today) {
    flags.push({ code: "expired", severity: "critical", message: "انتهت صلاحية العرض" });
  } else if (daysBetween(today, q.valid_until) <= 7) {
    flags.push({ code: "expires_soon", severity: "warning", message: `تنتهي صلاحيته خلال ${daysBetween(today, q.valid_until)} يوم` });
  }
  if (q.lead_time_days === null) {
    flags.push({ code: "missing_lead_time", severity: "warning", message: "مدة التوريد غير مذكورة" });
  } else if (eventStart && addDays(today, q.lead_time_days) > eventStart) {
    flags.push({ code: "late_delivery", severity: "critical", message: "التوريد يتجاوز موعد بدء الفعالية" });
  }
  if (q.scope_basis === "unspecified") flags.push({ code: "unspecified_scope", severity: "warning", message: "أساس التسعير غير محدد" });
  if (!q.payment_terms.trim()) flags.push({ code: "missing_terms", severity: "info", message: "شروط الدفع غير مذكورة" });
  if (q.exclusions.trim()) flags.push({ code: "exclusions", severity: "info", message: `يستثني: ${q.exclusions.trim().slice(0, 120)}` });
  return flags;
}

/**
 * Compares the quotes of one RFQ. Rejected quotes are listed without flags and never recommended.
 * The recommendation is the lowest complete price among quotes without critical issues, with its reasons
 * and caveats; when none qualifies it says why. It is advice from the entered data, not a decision.
 */
export function compareQuotes(quotes: readonly CompareQuote[], ctx: { today: string; eventStart: string | null }): QuoteComparison {
  const active = quotes.filter((q) => q.status !== "rejected");
  const priced = active.filter((q) => q.amount !== null);
  const lowestAmount = priced.length ? Math.min(...priced.map((q) => q.amount as number)) : null;

  const rows: ComparedQuote[] = quotes.map((q) => {
    const rejected = q.status === "rejected";
    const flags = rejected ? [] : flagsFor(q, ctx.today, ctx.eventStart);
    const lowest = !rejected && q.amount !== null && q.amount === lowestAmount;
    const abovePct = !rejected && q.amount !== null && lowestAmount && q.amount !== lowestAmount
      ? Math.round(((q.amount - lowestAmount) / lowestAmount) * 100)
      : null;
    return { quote: q, flags, lowest, abovePct, deliveryDate: q.lead_time_days !== null ? addDays(ctx.today, q.lead_time_days) : null };
  });

  const bases = new Set(priced.map((q) => q.scope_basis).filter((b) => b !== "unspecified"));
  const likeForLike = bases.size <= 1;
  const notes: string[] = [];
  if (!likeForLike) {
    notes.push(`العروض ليست على أساس واحد (${[...bases].map((b) => SCOPE_BASIS_LABEL[b]).join(" / ")}): قارن بحذر أو أضف مخصصات للفروق.`);
  }
  if (priced.length < 2 && active.length > 0) notes.push("المقارنة أدق مع عرضين مسعّرين على الأقل.");

  const critical = (id: string) => rows.find((r) => r.quote.id === id)!.flags.some((f) => f.severity === "critical");
  const eligible = priced.filter((q) => !critical(q.id)).sort((a, b) => (a.amount as number) - (b.amount as number));
  let recommendation: Recommendation;
  if (eligible.length === 0) {
    recommendation = {
      quoteId: null,
      reasons: [active.length ? "لا يوجد عرض مكتمل بلا مشكلات حرجة يمكن التوصية به." : "لا توجد عروض بعد."],
      caveats: [],
    };
  } else {
    const best = eligible[0];
    const next = eligible[1];
    const reasons = [next
      ? `أقل سعر بين العروض المكتملة، أقل من التالي (${next.supplier}) بنسبة ${Math.round((((next.amount as number) - (best.amount as number)) / (next.amount as number)) * 100)}%.`
      : "العرض المكتمل الوحيد بلا مشكلات حرجة."];
    const cheapest = priced.slice().sort((a, b) => (a.amount as number) - (b.amount as number))[0];
    if (cheapest && cheapest.id !== best.id) {
      const why = rows.find((r) => r.quote.id === cheapest.id)!.flags.filter((f) => f.severity === "critical").map((f) => f.message).join("، ");
      reasons.push(`العرض الأرخص (${cheapest.supplier}) مستبعد: ${why}.`);
    }
    const caveats = rows.find((r) => r.quote.id === best.id)!.flags.filter((f) => f.severity !== "critical").map((f) => f.message);
    if (!likeForLike) caveats.push("العروض ليست على أساس واحد.");
    recommendation = { quoteId: best.id, reasons, caveats };
  }
  return { rows, likeForLike, notes, recommendation };
}
