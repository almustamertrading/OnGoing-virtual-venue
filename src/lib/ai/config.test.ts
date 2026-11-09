import { describe, expect, it } from "vitest";
import { aiErrorMessage, checkAttempts, chooseProvider, readAiLimits, requestHash } from "./config";

const NOW = Date.parse("2026-11-09T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const limits = readAiLimits({});

describe("readAiLimits", () => {
  it("uses safe defaults", () => {
    expect(limits.perHour).toEqual({ proposal_draft: 10, rfp_extract: 10 });
    expect(limits.perDay).toEqual({ proposal_draft: 40, rfp_extract: 30 });
    expect(limits.orgMonthlyTokens).toBe(3_000_000);
    expect(limits.duplicateWindowMinutes).toBe(10);
  });

  it("reads positive integers from the environment and ignores anything else", () => {
    const l = readAiLimits({
      AI_LIMIT_PROPOSAL_DRAFT_PER_HOUR: "3",
      AI_LIMIT_RFP_EXTRACT_PER_DAY: "5",
      AI_ORG_MONTHLY_TOKEN_LIMIT: "-1",
      AI_DUPLICATE_WINDOW_MINUTES: "abc",
      AI_LIMIT_PROPOSAL_DRAFT_PER_DAY: "2.5",
    });
    expect(l.perHour.proposal_draft).toBe(3);
    expect(l.perDay.rfp_extract).toBe(5);
    expect(l.orgMonthlyTokens).toBe(3_000_000);
    expect(l.duplicateWindowMinutes).toBe(10);
    expect(l.perDay.proposal_draft).toBe(40);
  });
});

describe("chooseProvider", () => {
  it("uses the mock only when explicitly asked", () => {
    expect(chooseProvider({ AI_PROVIDER: "mock", ANTHROPIC_API_KEY: "x" })).toBe("mock");
    expect(chooseProvider({ ANTHROPIC_API_KEY: "x" })).toBe("anthropic");
  });

  it("reports nothing configured instead of silently using the mock", () => {
    expect(chooseProvider({})).toBeNull();
    expect(chooseProvider({ ANTHROPIC_API_KEY: "" })).toBeNull();
  });
});

describe("requestHash", () => {
  it("is a stable sha-256 that ignores whitespace differences", () => {
    const a = requestHash("proposal_draft", ["p1", "Brief  text\n here"]);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(requestHash("proposal_draft", ["p1", " Brief text here "])).toBe(a);
  });

  it("differs by feature and by content", () => {
    const a = requestHash("proposal_draft", ["p1", "brief"]);
    expect(requestHash("rfp_extract", ["p1", "brief"])).not.toBe(a);
    expect(requestHash("proposal_draft", ["p2", "brief"])).not.toBe(a);
    // Parts are separated, so moving text between parts changes the hash.
    expect(requestHash("proposal_draft", ["p1b", "rief"])).not.toBe(a);
  });
});

describe("checkAttempts", () => {
  const hash = "h".repeat(64);

  it("allows a first request", () => {
    expect(checkAttempts([], "proposal_draft", hash, limits, NOW)).toEqual({ ok: true });
  });

  it("refuses an identical request while one is still running, even when forced", () => {
    const attempts = [{ status: "started", request_hash: hash, created_at: minutesAgo(1) }];
    expect(checkAttempts(attempts, "proposal_draft", hash, limits, NOW)).toEqual({ ok: false, code: "in_progress" });
    expect(checkAttempts(attempts, "proposal_draft", hash, limits, NOW, true)).toEqual({ ok: false, code: "in_progress" });
  });

  it("refuses a repeat of a recent success unless forced, and says how long ago it ran", () => {
    const attempts = [{ status: "success", request_hash: hash, created_at: minutesAgo(4) }];
    expect(checkAttempts(attempts, "proposal_draft", hash, limits, NOW)).toEqual({ ok: false, code: "duplicate", minutesAgo: 4 });
    expect(checkAttempts(attempts, "proposal_draft", hash, limits, NOW, true)).toEqual({ ok: true });
  });

  it("allows the same request again after the duplicate window", () => {
    const attempts = [{ status: "success", request_hash: hash, created_at: minutesAgo(30) }];
    expect(checkAttempts(attempts, "proposal_draft", hash, limits, NOW)).toEqual({ ok: true });
  });

  it("enforces the hourly limit, counting failures but not refused (rate-limited) attempts", () => {
    const tenErrors = Array.from({ length: 10 }, (_, i) => ({ status: "error", request_hash: `x${i}`, created_at: minutesAgo(5 + i) }));
    expect(checkAttempts(tenErrors, "proposal_draft", hash, limits, NOW)).toEqual({ ok: false, code: "rate_limited" });
    const refused = Array.from({ length: 20 }, (_, i) => ({ status: "rate_limited", request_hash: `r${i}`, created_at: minutesAgo(1) }));
    expect(checkAttempts(refused, "proposal_draft", hash, limits, NOW)).toEqual({ ok: true });
  });

  it("enforces the daily limit with older attempts", () => {
    const day = Array.from({ length: 40 }, (_, i) => ({ status: "success", request_hash: `d${i}`, created_at: minutesAgo(120 + i * 10) }));
    expect(checkAttempts(day, "proposal_draft", hash, limits, NOW)).toEqual({ ok: false, code: "rate_limited" });
  });
});

describe("aiErrorMessage", () => {
  it("explains every failure in Arabic without provider details", () => {
    expect(aiErrorMessage("duplicate", { minutesAgo: 3 })).toContain("3");
    for (const code of ["not_configured", "rate_limited", "budget_exceeded", "in_progress", "refused", "too_large", "overloaded", "network", "invalid_output", "failed"] as const) {
      const msg = aiErrorMessage(code);
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toMatch(/anthropic|api key|stack|error:/i);
    }
  });
});
