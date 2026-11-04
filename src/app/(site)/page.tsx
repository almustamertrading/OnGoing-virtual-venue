import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { FeaturedProject, WorkCta } from "@/components/site/project-card";
import { clients, company, projects, services, stats } from "@/lib/site-content";

export default function HomePage() {
  const featured = projects.filter((p) => p.featured);
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.18),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.6)_1px,transparent_0)] [background-size:26px_26px]" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:py-28">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">
            تأسست {company.founded} · {company.city}
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.2] text-white sm:text-6xl">
            نصنع تجارب لا تُنسى، <span className="bg-gradient-to-l from-emerald-300 to-emerald-500 bg-clip-text text-transparent">من الفكرة إلى التشغيل</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            {company.legalAr}. نصمّم وننفّذ ونشغّل الفعاليات الإبداعية والثقافية والمعارض والمؤتمرات، بخدمة متكاملة 360°.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400">تواصل معنا</Link>
            <Link href="/work" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-bold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300">
              شاهد أعمالنا <ArrowUpLeft size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-4 py-10 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-emerald-400 sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold text-white">من نحن</h2>
            <p className="mt-4 leading-8 text-slate-300">
              مؤسسة سعودية متخصصة في تنظيم وتصميم وتنفيذ وتشغيل الفعاليات الترفيهية الإبداعية والاحتفالات الثقافية والمعارض والمؤتمرات، بقيادة {company.founder}.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="font-bold text-emerald-300">رؤيتنا</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">{company.vision}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="font-bold text-emerald-300">رسالتنا</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">{company.mission}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-extrabold text-white">خدماتنا 360°</h2>
          <p className="mt-2 text-slate-400">من الفكرة إلى آخر لحظة في الموقع.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.title} className="rounded-2xl border border-white/10 bg-[#0b1120] p-5">
                <h3 className="text-lg font-extrabold text-white">{s.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  {s.items.map((i) => (
                    <li key={i} className="flex items-start gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" />{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured work */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white">أبرز الأعمال</h2>
            <p className="mt-2 text-slate-400">نماذج من مشاريع نفّذناها على أرض الواقع.</p>
          </div>
          <WorkCta />
        </div>
        <div className="space-y-5">
          {featured.map((p) => <FeaturedProject key={p.slug} project={p} />)}
        </div>
      </section>

      {/* Clients */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <h2 className="text-center text-xl font-extrabold text-white">نفخر بالعمل مع نخبة من الجهات</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {clients.map((c) => (
              <span key={c} className="rounded-full border border-white/10 bg-[#0b1120] px-4 py-2 text-sm text-slate-300">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Contact band */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-l from-emerald-500/10 to-transparent p-8 sm:p-12">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">عندك فعالية قادمة؟</h2>
          <p className="mt-3 max-w-xl leading-8 text-slate-300">خلّنا نحوّل فكرتك إلى تجربة متكاملة. تواصل معنا اليوم ونبدأ من المفهوم حتى التشغيل.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/contact" className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400">ابدأ مشروعك</Link>
            <a dir="ltr" href={`tel:${company.phoneLink}`} className="rounded-lg border border-white/15 px-5 py-3 text-sm font-bold text-slate-100 transition hover:border-emerald-400/60">{company.phone}</a>
          </div>
        </div>
      </section>
    </>
  );
}
