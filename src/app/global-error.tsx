"use client";

/**
 * Last-resort screen when the root layout itself fails. It replaces the whole document, so it carries its own
 * minimal styles (the app's stylesheet may not be available).
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1120", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        <title>حدث خطأ | OnGoing</title>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>تعذّر تحميل OnGoing</h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.</p>
          {digest && <p dir="ltr" style={{ color: "#8292a8", fontSize: 12, fontFamily: "monospace" }}>رمز الخطأ: {digest}</p>}
          <button type="button" onClick={() => retry()} style={{ marginTop: 20, padding: "8px 16px", borderRadius: 6, border: 0, background: "#10b981", color: "#020617", fontWeight: 600, cursor: "pointer" }}>
            حاول مرة أخرى
          </button>
        </main>
      </body>
    </html>
  );
}
