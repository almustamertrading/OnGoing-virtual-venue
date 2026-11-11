"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * Shown when a page fails to render. In production the message never contains server details; the digest
 * matches the server log entry, so support can find the cause.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;
  return (
    <main dir="rtl" lang="ar" className="flex flex-1 items-center justify-center px-4 py-16" data-testid="error-page">
      <title>حدث خطأ | OnGoing</title>
      <div className="card w-full max-w-md p-6 text-center">
        <Logo className="mb-6 justify-center" />
        <h1 className="text-xl font-semibold text-white">تعذّر عرض هذه الصفحة</h1>
        <p className="mt-2 text-sm text-slate-400">حدث خطأ غير متوقع. حاول مرة أخرى، وإن تكرر الخطأ أرسل رمزه إلى مدير المنظمة.</p>
        {digest && <p className="mt-3 font-mono text-xs text-slate-500" dir="ltr">رمز الخطأ: {digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => retry()} className="btn-primary">حاول مرة أخرى</button>
          <Link href="/projects" className="btn-ghost">المشاريع</Link>
        </div>
      </div>
    </main>
  );
}
