import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, isRecentEmailLogin, validateNewPassword } from "./password-policy";

describe("validateNewPassword", () => {
  const good = "correct-horse-battery";
  it("accepts a long, matching, different password", () => {
    expect(validateNewPassword(good, good, "old-password-1")).toBeNull();
  });
  it("requires the current password unless in recovery", () => {
    expect(validateNewPassword(good, good, "")).toMatch(/الحالية/);
    expect(validateNewPassword(good, good, null)).toBeNull();
  });
  it(`requires at least ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(validateNewPassword("short-pass", "short-pass", "x")).toMatch(/12/);
  });
  it("requires the confirmation to match", () => {
    expect(validateNewPassword(good, good + "x", "old")).toMatch(/متطابقتين/);
  });
  it("rejects reusing the current password and trivial passwords", () => {
    expect(validateNewPassword(good, good, good)).toMatch(/مختلفة/);
    expect(validateNewPassword("aaaaaaaaaaaaaa", "aaaaaaaaaaaaaa", null)).toMatch(/ضعيفة/);
  });
});

describe("isRecentEmailLogin", () => {
  const now = 1_800_000_000;
  it("is true for a recovery login in the last 15 minutes", () => {
    expect(isRecentEmailLogin([{ method: "recovery", timestamp: now - 60 }], now)).toBe(true);
    expect(isRecentEmailLogin([{ method: "otp", timestamp: now - 899 }], now)).toBe(true);
  });
  it("is false for password logins, old links and bad input", () => {
    expect(isRecentEmailLogin([{ method: "password", timestamp: now }], now)).toBe(false);
    expect(isRecentEmailLogin([{ method: "recovery", timestamp: now - 16 * 60 }], now)).toBe(false);
    expect(isRecentEmailLogin(undefined, now)).toBe(false);
    expect(isRecentEmailLogin([{ method: "recovery" }], now)).toBe(false);
  });
});
