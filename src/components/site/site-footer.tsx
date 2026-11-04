import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { company } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/40">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-extrabold text-black">OG</span>
            <span className="text-base font-extrabold text-white">{company.nameAr}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">{company.taglineEn}</p>
          <p className="mt-1 text-sm text-slate-400">{company.tagline}</p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-white">روابط</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/" className="hover:text-emerald-300">الرئيسية</Link></li>
            <li><Link href="/work" className="hover:text-emerald-300">أعمالنا</Link></li>
            <li><Link href="/contact" className="hover:text-emerald-300">تواصل معنا</Link></li>
            <li><Link href="/login" className="hover:text-emerald-300">دخول الفريق</Link></li>
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-bold text-white">تواصل</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-center gap-2"><Phone size={15} className="text-emerald-400" /><a dir="ltr" href={`tel:${company.phoneLink}`} className="hover:text-emerald-300">{company.phone}</a></li>
            <li className="flex items-center gap-2"><Mail size={15} className="text-emerald-400" /><a href={`mailto:${company.email}`} className="hover:text-emerald-300">{company.email}</a></li>
            <li className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-emerald-400" /><span>{company.address}</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © 2026 {company.legalAr} — جميع الحقوق محفوظة
      </div>
    </footer>
  );
}
