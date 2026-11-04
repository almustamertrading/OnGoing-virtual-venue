import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { company } from "@/lib/site-content";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: `تواصل معنا | ${company.nameAr}`,
  description: `تواصل مع ${company.legalAr} لتخطيط وتنفيذ فعاليتك القادمة.`,
};

export default function ContactPage() {
  const wa = `https://wa.me/${company.phoneLink.replace("+", "")}`;
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-extrabold text-white sm:text-5xl">تواصل معنا</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-300">
        عندك فعالية أو مشروع؟ تواصل معنا ونبدأ من الفكرة حتى التشغيل.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <a href={`tel:${company.phoneLink}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-amber-400/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400"><Phone size={20} /></span>
            <div>
              <p className="text-xs text-stone-400">اتصال</p>
              <p dir="ltr" className="text-left font-bold text-white">{company.phone}</p>
            </div>
          </a>
          <a href={wa} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-amber-400/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400"><MessageCircle size={20} /></span>
            <div>
              <p className="text-xs text-stone-400">واتساب</p>
              <p dir="ltr" className="text-left font-bold text-white">{company.phone}</p>
            </div>
          </a>
          <a href={`mailto:${company.email}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-amber-400/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400"><Mail size={20} /></span>
            <div>
              <p className="text-xs text-stone-400">البريد</p>
              <p className="font-bold text-white">{company.email}</p>
            </div>
          </a>
          <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400"><MapPin size={20} /></span>
            <div>
              <p className="text-xs text-stone-400">العنوان</p>
              <p className="font-medium text-stone-200">{company.address}</p>
            </div>
          </div>
        </div>

        <ContactForm />
      </div>
    </section>
  );
}
