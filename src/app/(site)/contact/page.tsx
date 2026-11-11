import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { company } from "@/lib/site-content";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: `تواصل معنا | ${company.nameEn}`,
  description: `تواصل مع ${company.legalAr} (${company.nameEn}) لتخطيط وتنفيذ فعاليتك القادمة.`,
};

const Row = ({ icon, label, value, href, ltr = false }: { icon: React.ReactNode; label: string; value: string; href?: string; ltr?: boolean }) => {
  const inner = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-line text-gold">{icon}</span>
      <div className="min-w-0">
        <p className="eyebrow text-left">{label}</p>
        <p dir={ltr ? "ltr" : undefined} className={`mt-1 font-bold text-sand ${ltr ? "la text-left" : ""}`}>{value}</p>
      </div>
    </>
  );
  const cls = "flex items-center gap-4 border-b border-line py-5 transition hover:text-gold";
  return href ? <a href={href} className={cls}>{inner}</a> : <div className={cls}>{inner}</div>;
};

export default function ContactPage() {
  const wa = `https://wa.me/${company.phoneLink.replace("+", "")}`;
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
      <p className="eyebrow text-left">Contact</p>
      <h1 className="mt-3 text-4xl font-extrabold text-sand sm:text-5xl">تواصل معنا</h1>
      <span className="rule-dot mt-6" aria-hidden />
      <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">عندك فعالية أو مشروع؟ تواصل معنا ونبدأ من الفكرة حتى التشغيل.</p>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <div className="border-t border-line">
          <Row icon={<Phone size={18} />} label="Call" value={company.phone} href={`tel:${company.phoneLink}`} ltr />
          <Row icon={<MessageCircle size={18} />} label="WhatsApp" value={company.phone} href={wa} ltr />
          <Row icon={<Mail size={18} />} label="Email" value={company.email} href={`mailto:${company.email}`} ltr />
          <Row icon={<MapPin size={18} />} label="Office" value={company.address} />
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
