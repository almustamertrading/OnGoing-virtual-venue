import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpLeft, Download } from "lucide-react";
import { approach, clients, company, gallery, galleryCategories, projects, services, stats } from "@/lib/site-content";
import { ProjectCard } from "@/components/site/project-card";
import { PhotoLibrary } from "./gallery";

export const metadata: Metadata = {
  title: `الملف التعريفي | ${company.nameEn}`,
  description: `الملف التعريفي لشركة ${company.legalAr} (${company.nameEn}): من نحن، خدماتنا، أسلوب عملنا، ومكتبة صور المشاريع.`,
};

const sections = [
  { id: "about", label: "من نحن" },
  { id: "numbers", label: "بالأرقام" },
  { id: "services", label: "الخدمات" },
  { id: "approach", label: "أسلوب العمل" },
  { id: "projects", label: "المشاريع" },
  { id: "library", label: "مكتبة الصور" },
  { id: "clients", label: "العملاء" },
  { id: "entity", label: "الكيان" },
];

export default function ProfilePage() {
  const library = gallery.filter((g) => !g.project);
  return (
    <>
      {/* Cover */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="photo-bw grain absolute inset-0">
          <Image src="/projects/og-036-251.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-30" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-4 py-24 sm:py-32">
          <p className="eyebrow text-left">Company profile · 2026</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.2] text-sand sm:text-6xl">الملف التعريفي</h1>
          <span className="rule-dot mt-7" aria-hidden />
          <p className="mt-6 max-w-2xl text-lg leading-8 text-sand/85">
            {company.legalAr} — {company.nameEn}. {company.tagline}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/downloads/Ongoing-Events-Company-Profile.pdf" className="btn-gold" download>
              <Download size={16} /> تحميل الملف (PDF)
            </a>
            <Link href="/contact" className="btn-line">تواصل معنا</Link>
          </div>
        </div>
      </section>

      {/* Section index */}
      <nav aria-label="أقسام الملف" className="sticky top-16 z-30 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 py-2 text-xs">
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`} className="shrink-0 px-3 py-2 text-sand/80 hover:text-gold">
              <span className="num text-gold">{String(i + 1).padStart(2, "0")}</span> {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* About */}
      <section id="about" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-20">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="eyebrow text-left">01 · About</p>
            <h2 className="mt-3 text-3xl font-extrabold text-sand">من نحن</h2>
            <span className="rule-dot mt-5" aria-hidden />
          </div>
          <div className="space-y-5 leading-8 text-muted lg:col-span-7">
            <p>
              {company.nameEn} هي العلامة التجارية لشركة {company.legalAr}، شركة سعودية مقرّها {company.city}، تأسست عام {company.founded}، متخصصة في تنظيم وتصميم وتنفيذ وتشغيل الفعاليات الترفيهية الإبداعية والاحتفالات الثقافية والمعارض والمؤتمرات، بقيادة {company.founder}.
            </p>
            <p>
              نعمل كجهة واحدة مسؤولة عن المشروع من أول اجتماع حتى آخر شاحنة تغادر الموقع: المفهوم، التصميم ثلاثي الأبعاد، الإنتاج والتصنيع، القوى العاملة، الإعلام، والتشغيل اليومي.
            </p>
            <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
              <div className="bg-ink p-6"><p className="eyebrow text-left">Vision</p><p className="mt-3 text-sm leading-7 text-sand/90">{company.vision}</p></div>
              <div className="bg-ink p-6"><p className="eyebrow text-left">Mission</p><p className="mt-3 text-sm leading-7 text-sand/90">{company.mission}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section id="numbers" className="scroll-mt-28 border-y border-line bg-ink2">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <p className="eyebrow text-left">02 · In numbers</p>
          <div className="mt-8 grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <p dir="ltr" className="num text-5xl font-bold text-gold">{s.value}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-20">
        <p className="eyebrow text-left">03 · Services 360°</p>
        <h2 className="mt-3 text-3xl font-extrabold text-sand">الخدمات</h2>
        <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <div key={s.title} className="bg-ink p-6">
              <div className="flex items-baseline justify-between"><h3 className="font-extrabold text-sand">{s.title}</h3><span className="num text-sm text-gold">{String(i + 1).padStart(2, "0")}</span></div>
              <ul className="mt-4 space-y-2 text-sm text-muted">{s.items.map((it) => <li key={it} className="flex items-start gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{it}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      {/* Approach */}
      <section id="approach" className="scroll-mt-28 border-y border-line bg-ink2">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <p className="eyebrow text-left">04 · How we work</p>
          <h2 className="mt-3 text-3xl font-extrabold text-sand">أسلوب العمل</h2>
          <ol className="relative mt-10 grid gap-8 md:grid-cols-5">
            <span className="absolute right-0 left-0 top-[7px] hidden h-px bg-line md:block" aria-hidden />
            {approach.map((a) => (
              <li key={a.step} className="relative">
                <span className="relative z-10 block h-[15px] w-[15px] rounded-full border-2 border-gold bg-ink2" aria-hidden />
                <p className="num mt-4 text-sm text-gold">{a.step}</p>
                <h3 className="mt-1 font-extrabold text-sand">{a.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted">{a.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Projects */}
      <section id="projects" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-left">05 · Projects</p>
            <h2 className="mt-3 text-3xl font-extrabold text-sand">المشاريع</h2>
          </div>
          <Link href="/work" className="btn-line">كل الأعمال <ArrowUpLeft size={16} /></Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.filter((p) => p.cover).slice(0, 6).map((p) => <ProjectCard key={p.slug} project={p} />)}
        </div>
      </section>

      {/* Library */}
      <section id="library" className="scroll-mt-28 border-y border-line bg-ink2">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <p className="eyebrow text-left">06 · Photo library</p>
          <h2 className="mt-3 text-3xl font-extrabold text-sand">مكتبة صور المشاريع</h2>
          <p className="mt-2 max-w-2xl text-muted">لقطات من مواقع نفّذناها، مصنّفة حسب نوع البيئة. بالأبيض والأسود في العرض، وبألوانها الكاملة عند التكبير.</p>
          <div className="mt-8">
            <PhotoLibrary items={library} categories={galleryCategories} />
          </div>
        </div>
      </section>

      {/* Clients */}
      <section id="clients" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-20">
        <p className="eyebrow text-left">07 · Clients &amp; partners</p>
        <h2 className="mt-3 text-3xl font-extrabold text-sand">العملاء والشركاء</h2>
        <div className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-4">
          {clients.map((c) => <div key={c} className="bg-ink px-5 py-4 text-sm text-sand/85">{c}</div>)}
        </div>
      </section>

      {/* Entity */}
      <section id="entity" className="scroll-mt-28 border-t border-line bg-ink2">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <p className="eyebrow text-left">08 · Legal entity</p>
          <h2 className="mt-3 text-3xl font-extrabold text-sand">الكيان القانوني</h2>
          <dl className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-ink p-5"><dt className="eyebrow text-left">Legal name</dt><dd className="mt-2 text-sm text-sand">{company.legalAr}</dd><dd className="la mt-1 text-xs text-muted" dir="ltr">{company.legalEn}</dd></div>
            <div className="bg-ink p-5"><dt className="eyebrow text-left">Brand</dt><dd className="la mt-2 text-sm text-sand">{company.nameEn}</dd></div>
            <div className="bg-ink p-5"><dt className="eyebrow text-left">Commercial registration</dt><dd className="num mt-2 text-sm text-sand" dir="ltr">{company.cr}</dd></div>
            <div className="bg-ink p-5"><dt className="eyebrow text-left">Head office</dt><dd className="mt-2 text-sm text-sand">{company.address}</dd></div>
          </dl>
          <p className="mt-6 text-xs text-muted">وثائق التأهيل (السجل التجاري، شهادات الزكاة والضريبة والتأمينات، العنوان الوطني) تُرسل عند الطلب ضمن ملف التأهيل.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/downloads/Ongoing-Events-Company-Profile.pdf" className="btn-gold" download><Download size={16} /> تحميل الملف التعريفي</a>
            <Link href="/contact" className="btn-line">طلب ملف التأهيل</Link>
          </div>
        </div>
      </section>
    </>
  );
}
