/**
 * Returns a same-site path to continue to after login or an email link, or the fallback.
 * Rejects absolute URLs, protocol-relative URLs ("//x") and backslash tricks ("/\x"),
 * which browsers can turn into a redirect to another site (open redirect).
 */
export function safeNext(value: unknown, fallback = "/projects"): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  const base = "http://same.origin.invalid";
  try {
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
