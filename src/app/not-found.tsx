import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "الصفحة غير موجودة | OnGoing" };

/**
 * Shown for unknown addresses and whenever a page calls notFound(), including records the viewer may not open
 * (a project they are not on). The wording covers both without revealing whether the record exists.
 */
export default function NotFound() {
  return (
    <main dir="rtl" lang="ar" className="flex flex-1 items-center justify-center px-4 py-16" data-testid="not-found">
      <div className="card w-full max-w-md p-6 text-center">
        <Logo className="mb-6 justify-center" />
        <p className="font-mono text-sm text-emerald-400">404</p>
        <h1 className="mt-1 text-xl font-semibold text-white">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-slate-400">
          لم نجد هذه الصفحة، أو ليست لديك صلاحية الوصول إليها. إن وصلت إليها من رابط مشروع، اطلب من مدير المشروع إضافتك.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/projects" className="btn-primary">المشاريع</Link>
          <Link href="/" className="btn-ghost">الصفحة الرئيسية</Link>
        </div>
      </div>
    </main>
  );
}
