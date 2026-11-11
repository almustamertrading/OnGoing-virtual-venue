import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowUpLeft, ArrowUpRight } from "lucide-react";
import { company, projects } from "@/lib/site-content";
import { ProjectCard } from "@/components/site/project-card";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = projects.find((x) => x.slug === slug);
  if (!p) return {};
  return { title: `${p.title} | ${company.nameEn}`, description: p.summary };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const i = projects.findIndex((x) => x.slug === slug);
  if (i < 0) notFound();
  const p = projects[i];
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  const more = projects.filter((x) => x.slug !== p.slug && x.category === p.category).slice(0, 3);
  const gallery = p.gallery && p.gallery.length ? p.gallery : p.cover ? [p.cover] : [];

  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-4 pt-12">
          <Link href="/work" className="eyebrow inline-flex items-center gap-2 text-left hover:underline">
            <ArrowUpRight size={14} /> Back to work
          </Link>
          <div className="mt-6 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="eyebrow text-left">{p.year} · {p.location}{p.category ? ` · ${p.category}` : ""}</p>
              <h1 className="mt-3 text-3xl font-extrabold leading-snug text-sand sm:text-5xl">{p.title}</h1>
              <p className="mt-3 text-gold">{p.client}</p>
              <span className="rule-dot mt-6" aria-hidden />
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">{p.summary}</p>
            </div>
            <div className="lg:col-span-5">
              <h2 className="eyebrow text-left">Scope</h2>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3 py-3 text-sm text-sand/90"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{h}</li>
                ))}
              </ul>
              {p.metrics && (
                <dl className="mt-6 grid grid-cols-3 gap-3">
                  {p.metrics.map((m) => (
                    <div key={m.label}>
                      <dt className="num text-3xl font-bold text-sand">{m.value}</dt>
                      <dd className="mt-1 text-xs leading-5 text-muted">{m.label}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
          {gallery[0] ? (
            <div className="photo-bw grain is-color relative mt-12 aspect-[21/9] overflow-hidden bg-ink2">
              <Image src={gallery[0]} alt={p.title} fill priority sizes="100vw" className="object-cover" />
            </div>
          ) : (
            <div className="mt-12 h-px" />
          )}
        </div>
      </section>

      {gallery.length > 1 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-14">
          <p className="eyebrow text-left">Gallery</p>
          <h2 className="mt-3 text-2xl font-extrabold text-sand">من الموقع</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.slice(1).map((src) => (
              <div key={src} className="photo-bw grain relative aspect-[4/3] overflow-hidden bg-ink2">
                <Image src={src} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm">
          <Link href={`/work/${prev.slug}`} className="inline-flex items-center gap-2 text-sand/80 hover:text-gold"><ArrowUpRight size={16} /> {prev.title}</Link>
          <Link href={`/work/${next.slug}`} className="inline-flex items-center gap-2 text-sand/80 hover:text-gold">{next.title} <ArrowUpLeft size={16} /></Link>
        </div>
      </section>

      {more.length > 0 && (
        <section className="border-t border-line bg-ink2">
          <div className="mx-auto w-full max-w-6xl px-4 py-14">
            <p className="eyebrow text-left">More in {p.category}</p>
            <div className="mt-6 grid gap-6 md:grid-cols-3">{more.map((m) => <ProjectCard key={m.slug} project={m} />)}</div>
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4 border border-line p-8">
          <div>
            <h2 className="text-2xl font-extrabold text-sand">مشروع مشابه؟</h2>
            <p className="mt-2 text-muted">نرسل لك عرضًا فنيًا خلال أيام عمل.</p>
          </div>
          <Link href="/contact" className="btn-gold">ابدأ مشروعك</Link>
        </div>
      </section>
    </>
  );
}
