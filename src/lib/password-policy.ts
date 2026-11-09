/** Minimum length for new passwords set in the app (stricter than the Auth server's minimum). */
export const MIN_PASSWORD_LENGTH = 12;

/** Returns an error message, or null when the new password is acceptable. */
export function validateNewPassword(next: string, confirm: string, current: string | null): string | null {
  if (current !== null && !current) return "أدخل كلمة المرور الحالية.";
  if (next.length < MIN_PASSWORD_LENGTH) return `كلمة المرور الجديدة يجب أن تكون ${MIN_PASSWORD_LENGTH} حرفًا على الأقل.`;
  if (next !== confirm) return "كلمتا المرور الجديدتان غير متطابقتين.";
  if (current !== null && next === current) return "اختر كلمة مرور مختلفة عن الحالية.";
  if (/^(.)\1+$/.test(next)) return "كلمة المرور ضعيفة جدًا.";
  return null;
}

type AmrEntry = { method?: string; timestamp?: number };

/**
 * True when the session came from an email link (password recovery, magic link / OTP) within the
 * last 15 minutes. Such a session has just proven ownership of the email, so the current password
 * is not required to set a new one.
 */
export function isRecentEmailLogin(amr: unknown, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!Array.isArray(amr)) return false;
  return (amr as AmrEntry[]).some(
    (a) =>
      (a.method === "recovery" || a.method === "otp" || a.method === "magiclink") &&
      typeof a.timestamp === "number" &&
      nowSeconds - a.timestamp <= 15 * 60,
  );
}
