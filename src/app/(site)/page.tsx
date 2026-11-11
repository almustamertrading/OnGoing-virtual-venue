import Link from "next/link";
import Image from "next/image";
import { ArrowUpLeft } from "lucide-react";
import { FeaturedProject, WorkCta } from "@/components/site/project-card";
import { approach, clients, company, projects, services, stats } from "@/lib/site-content";

export default function HomePage() {
  const featured = projects.filter((p) => p.featured);
  return (
    <>
      {/* Hero: one headline, one photo, one gold element */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:py-28 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow text-left">Event production · Riyadh · est. {company.founded}</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.25] text-sand sm:text-6xl">
              نصنع تجارب لا تُنسى،
              <br />
              من الفكرة إلى التشغيل.
            </h1>
            <span className="rule-dot mt-7" aria-hidden />
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              {company.legalAr} ({company.nameEn}). نصمّم وننفّذ ونشغّل الفعاليات الإبداعية والثقافية والمعارض والمؤتمرات، بخدمة متكاملة 360°.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/contact" className="btn-gold">ابدأ مشروعك</Link>
              <Link href="/work" className="btn-line">
                شاهد أعمالنا <ArrowUpLeft size={16} />
              </Link>
            </div>
          </div>
          <div className="photo-bw grain relative aspect-[4/5] overflow-hidden bg-ink2 lg:col-span-5 lg:aspect-auto">
            <Image src="/projects/og-035-249.jpg" alt="" fill priority sizes="(min-width:1024px) 40vw, 100vw" className="object-cover" />
            <span className="eyebrow absolute bottom-4 left-4 bg-ink/80 px-2 py-1 text-left">Cultural event setting · Riyadh</span>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="border-b border-line bg-ink2">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-4 py-12 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p dir="ltr" className="num text-4xl font-bold text-gold sm:text-5xl">{s.value}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="eyebrow text-left">About</p>
            <h2 className="mt-3 text-3xl font-extrabold text-sand">من نحن</h2>
            <span className="rule-dot mt-5" aria-hidden />
            <p className="mt-6 leading-8 text-muted">
              شركة سعودية متخصصة في تنظيم وتصميم وتنفيذ وتشغيل الفعاليات الترفيهية الإبداعية والاحتفالات الثقافية والمعارض والمؤتمرات، بقيادة {company.founder}.
            </p>
            <Link href="/profile" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-gold hover:underline">
              الملف التعريفي الكامل <ArrowUpLeft size={16} />
            </Link>
          </div>
          <div className="grid gap-px border border-line bg-line md:col-span-7 sm:grid-cols-2">
            <div className="bg-ink p-6">
              <h3 className="eyebrow text-left">Vision</h3>
              <p className="mt-3 font-bold text-sand">رؤيتنا</p>
              <p className="mt-2 text-sm leading-7 text-muted">{company.vision}</p>
            </div>
            <div className="bg-ink p-6">
              <h3 className="eyebrow text-left">Mission</h3>
              <p className="mt-3 font-bold text-sand">رسالتنا</p>
              <p className="mt-2 text-sm leading-7 text-muted">{company.mission}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="border-y border-line bg-ink2">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <p className="eyebrow text-left">Services · 360°</p>
          <h2 className="mt-3 text-3xl font-extrabold text-sand">خدماتنا</h2>
          <p className="mt-2 text-muted">من الفكرة إلى آخر لحظة في الموقع.</p>
          <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <div key={s.title} className="bg-ink p-6">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-extrabold text-sand">{s.title}</h3>
                  <span className="num text-sm text-gold">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted">
                  {s.items.map((i) => (
                    <li key={i} className="flex items-start gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <p className="eyebrow text-left">How we work</p>
        <h2 className="mt-3 text-3xl font-extrabold text-sand">خط واحد من الفكرة إلى التسليم</h2>
        <ol className="relative mt-10 grid gap-8 md:grid-cols-5">
          <span className="absolute right-0 left-0 top-[7px] hidden h-px bg-line md:block" aria-hidden />
          {approach.map((a) => (
            <li key={a.step} className="relative">
              <span className="relative z-10 block h-[15px] w-[15px] rounded-full border-2 border-gold bg-ink" aria-hidden />
              <p className="num mt-4 text-sm text-gold">{a.step}</p>
              <h3 className="mt-1 font-extrabold text-sand">{a.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted">{a.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Featured work */}
      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-left">Selected work</p>
              <h2 className="mt-3 text-3xl font-extrabold text-sand">أبرز الأعمال</h2>
              <p className="mt-2 text-muted">مشاريع نفّذناها على أرض الواقع. الصور بالأبيض والأسود، وتعود للونها عند التحويم.</p>
            </div>
            <WorkCta />
          </div>
          <div className="space-y-6">
            {featured.map((p, i) => <FeaturedProject key={p.slug} project={p} index={i} />)}
          </div>
        </div>
      </section>

      {/* Clients */}
      <section className="border-t border-line bg-ink2">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <p className="eyebrow text-left">Clients &amp; partners</p>
          <h2 className="mt-3 text-2xl font-extrabold text-sand">نفخر بالعمل مع نخبة من الجهات</h2>
          <div className="mt-8 flex flex-wrap gap-2">
            {clients.map((c) => (
              <span key={c} className="border border-line px-4 py-2 text-sm text-sand/80">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Contact band */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <div className="relative overflow-hidden border border-line bg-ink p-8 sm:p-12">
          <div className="absolute inset-y-0 left-0 w-1/3 opacity-40 [background-image:url('/brand/pattern-ink.svg')] [background-size:520px] [mask-image:linear-gradient(to_right,black,transparent)]" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-extrabold text-sand sm:text-4xl">عندك فعالية قادمة؟</h2>
            <span className="rule-dot mt-5" aria-hidden />
            <p className="mt-5 max-w-xl leading-8 text-muted">خلّنا نحوّل فكرتك إلى تجربة متكاملة. تواصل معنا اليوم ونبدأ من المفهوم حتى التشغيل.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/contact" className="btn-gold">ابدأ مشروعك</Link>
              <a dir="ltr" href={`tel:${company.phoneLink}`} className="btn-line la">{company.phone}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
