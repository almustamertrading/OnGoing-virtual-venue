import Link from "next/link";
import { company } from "@/lib/site-content";
import { Wordmark } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Wordmark className="h-8" />
          <span className="rule-dot mt-5" aria-hidden />
          <p className="la mt-4 text-sm text-muted">{company.taglineEn}</p>
          <p className="mt-1 text-sm text-muted">{company.tagline}</p>
        </div>

        <div>
          <h3 className="eyebrow mb-4 text-left">Navigate</h3>
          <ul className="space-y-2 text-sm text-sand/80">
            <li><Link href="/" className="hover:text-gold">الرئيسية</Link></li>
            <li><Link href="/profile" className="hover:text-gold">الملف التعريفي</Link></li>
            <li><Link href="/work" className="hover:text-gold">أعمالنا</Link></li>
            <li><Link href="/contact" className="hover:text-gold">تواصل معنا</Link></li>
            <li><Link href="/login" className="hover:text-gold">دخول الفريق</Link></li>
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h3 className="eyebrow mb-4 text-left">Contact</h3>
          <ul className="space-y-2 text-sm text-sand/80">
            <li><a dir="ltr" href={`tel:${company.phoneLink}`} className="la inline-block hover:text-gold">{company.phone}</a></li>
            <li><a href={`mailto:${company.email}`} className="la hover:text-gold">{company.email}</a></li>
            <li className="text-muted">{company.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted">
          <span>© 2026 {company.legalAr} — جميع الحقوق محفوظة</span>
          <span className="la" dir="ltr">{company.legalEn} · CR {company.cr}</span>
        </div>
      </div>
    </footer>
  );
}
