import { createHash } from "node:crypto";
import type { AiErrorCode, AiFeature } from "./types";

export type AiLimits = {
  perHour: Record<AiFeature, number>;
  perDay: Record<AiFeature, number>;
  /** Input + output tokens an organisation may use per calendar month. */
  orgMonthlyTokens: number;
  /** An identical successful request within this window is refused unless forced. */
  duplicateWindowMinutes: number;
  /** One overall deadline per AI call, kept under the hosting platform's function limit (60 s). */
  timeoutMs: number;
  /** A request still "started" after this long is treated as abandoned (just above the deadline). */
  staleStartedMinutes: number;
};

const DEFAULTS: AiLimits = {
  perHour: { proposal_draft: 10, rfp_extract: 10, tender_analysis: 10, ops_extract: 20, management_brief: 6, boq_extract: 10 },
  perDay: { proposal_draft: 40, rfp_extract: 30, tender_analysis: 30, ops_extract: 80, management_brief: 20, boq_extract: 30 },
  orgMonthlyTokens: 3_000_000,
  duplicateWindowMinutes: 10,
  timeoutMs: 55_000,
  staleStartedMinutes: 2,
};

type Env = Record<string, string | undefined>;

function positiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Rate limits and budgets, configurable through environment variables (server only). */
export function readAiLimits(env: Env = process.env): AiLimits {
  // At least 10 s; at most 15 min (a background job's limit, should one ever run AI calls).
  const timeoutMs = Math.min(Math.max(positiveInt(env.AI_TIMEOUT_MS, DEFAULTS.timeoutMs), 10_000), 900_000);
  return {
    perHour: {
      proposal_draft: positiveInt(env.AI_LIMIT_PROPOSAL_DRAFT_PER_HOUR, DEFAULTS.perHour.proposal_draft),
      rfp_extract: positiveInt(env.AI_LIMIT_RFP_EXTRACT_PER_HOUR, DEFAULTS.perHour.rfp_extract),
      tender_analysis: positiveInt(env.AI_LIMIT_TENDER_ANALYSIS_PER_HOUR, DEFAULTS.perHour.tender_analysis),
      ops_extract: positiveInt(env.AI_LIMIT_OPS_EXTRACT_PER_HOUR, DEFAULTS.perHour.ops_extract),
      management_brief: positiveInt(env.AI_LIMIT_MANAGEMENT_BRIEF_PER_HOUR, DEFAULTS.perHour.management_brief),
      boq_extract: positiveInt(env.AI_LIMIT_BOQ_EXTRACT_PER_HOUR, DEFAULTS.perHour.boq_extract),
    },
    perDay: {
      proposal_draft: positiveInt(env.AI_LIMIT_PROPOSAL_DRAFT_PER_DAY, DEFAULTS.perDay.proposal_draft),
      rfp_extract: positiveInt(env.AI_LIMIT_RFP_EXTRACT_PER_DAY, DEFAULTS.perDay.rfp_extract),
      tender_analysis: positiveInt(env.AI_LIMIT_TENDER_ANALYSIS_PER_DAY, DEFAULTS.perDay.tender_analysis),
      ops_extract: positiveInt(env.AI_LIMIT_OPS_EXTRACT_PER_DAY, DEFAULTS.perDay.ops_extract),
      management_brief: positiveInt(env.AI_LIMIT_MANAGEMENT_BRIEF_PER_DAY, DEFAULTS.perDay.management_brief),
      boq_extract: positiveInt(env.AI_LIMIT_BOQ_EXTRACT_PER_DAY, DEFAULTS.perDay.boq_extract),
    },
    orgMonthlyTokens: positiveInt(env.AI_ORG_MONTHLY_TOKEN_LIMIT, DEFAULTS.orgMonthlyTokens),
    duplicateWindowMinutes: positiveInt(env.AI_DUPLICATE_WINDOW_MINUTES, DEFAULTS.duplicateWindowMinutes),
    timeoutMs,
    staleStartedMinutes: Math.max(DEFAULTS.staleStartedMinutes, Math.ceil(timeoutMs / 60_000) + 1),
  };
}

/**
 * Which provider serves AI requests. The mock is used only when explicitly requested
 * (tests, local development without a key); production without a key reports "not configured".
 */
export function chooseProvider(env: Env = process.env): "anthropic" | "mock" | null {
  if (env.AI_PROVIDER === "mock") return "mock";
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

/** Stable fingerprint of a request, used to spot repeats. Whitespace differences do not count. */
export function requestHash(feature: AiFeature, parts: readonly string[]): string {
  const normalized = parts.map((p) => p.replace(/\s+/g, " ").trim()).join("\u0000");
  return createHash("sha256").update(`${feature}\u0000${normalized}`).digest("hex");
}

type Attempt = { status: string; request_hash: string; created_at: string };

export type LimitDecision =
  | { ok: true }
  | { ok: false; code: Extract<AiErrorCode, "rate_limited" | "in_progress" | "duplicate">; minutesAgo?: number };

/** Decides whether a new request may run, from the user's attempts in the last 24 hours. */
export function checkAttempts(
  attempts: readonly Attempt[],
  feature: AiFeature,
  hash: string,
  limits: AiLimits,
  now: number,
  force = false,
): LimitDecision {
  const counted = attempts.filter((a) => a.status !== "rate_limited");
  if (counted.some((a) => a.request_hash === hash && a.status === "started")) return { ok: false, code: "in_progress" };
  if (!force) {
    const windowStart = now - limits.duplicateWindowMinutes * 60_000;
    const repeat = counted.find(
      (a) => a.request_hash === hash && a.status === "success" && Date.parse(a.created_at) >= windowStart,
    );
    if (repeat) return { ok: false, code: "duplicate", minutesAgo: Math.max(0, Math.round((now - Date.parse(repeat.created_at)) / 60_000)) };
  }
  const hourAgo = now - 60 * 60_000;
  const dayAgo = now - 24 * 60 * 60_000;
  if (counted.filter((a) => Date.parse(a.created_at) >= hourAgo).length >= limits.perHour[feature]) return { ok: false, code: "rate_limited" };
  if (counted.filter((a) => Date.parse(a.created_at) >= dayAgo).length >= limits.perDay[feature]) return { ok: false, code: "rate_limited" };
  return { ok: true };
}

/** Arabic explanation for each failure, without provider details. */
export function aiErrorMessage(code: AiErrorCode, extra?: { minutesAgo?: number }): string {
  switch (code) {
    case "not_configured":
      return "الذكاء الاصطناعي غير مفعّل بعد: يلزم إضافة مفتاح الخدمة في إعدادات الخادم.";
    case "rate_limited":
      return "تجاوزت الحد المسموح لطلبات الذكاء الاصطناعي حاليًا. حاول لاحقًا.";
    case "budget_exceeded":
      return "استُنفدت ميزانية الذكاء الاصطناعي الشهرية للمنظمة. تواصل مع مدير المنظمة.";
    case "in_progress":
      return "هناك طلب مطابق قيد التنفيذ الآن. انتظر حتى يكتمل.";
    case "duplicate":
      return `أُنجز طلب مطابق قبل ${extra?.minutesAgo ?? 0} دقيقة. فعّل «إعادة التوليد رغم التطابق» إن أردت نتيجة جديدة.`;
    case "refused":
      return "تعذّر على الذكاء الاصطناعي إكمال هذا الطلب. عدّل الموجز وحاول مجددًا.";
    case "too_large":
      return "المحتوى أكبر من الحد المسموح لطلب واحد. قسّم الملف أو اختصر الموجز.";
    case "overloaded":
      return "خدمة الذكاء الاصطناعي مشغولة حاليًا. حاول بعد دقيقة.";
    case "timeout":
      return "استغرق الطلب وقتًا أطول من المسموح فأُوقف. جرّب موجزًا أقصر أو ملفًا أصغر، أو أعد المحاولة.";
    case "network":
      return "تعذّر الاتصال بخدمة الذكاء الاصطناعي. تحقّق من الاتصال وحاول مجددًا.";
    case "invalid_output":
      return "جاءت النتيجة غير مكتملة. حاول مجددًا.";
    default:
      return "تعذّر إكمال طلب الذكاء الاصطناعي. حاول مجددًا.";
  }
}
