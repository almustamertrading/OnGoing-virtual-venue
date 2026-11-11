import Link from "next/link";
import Image from "next/image";
import { ArrowUpLeft } from "lucide-react";
import type { Project } from "@/lib/site-content";

function Cover({ project, className }: { project: Project; className: string }) {
  if (!project.cover) {
    return (
      <div className={`relative overflow-hidden bg-ink2 ${className}`}>
        <div className="absolute inset-0 opacity-50 [background-image:url('/brand/pattern-ink.svg')] [background-size:420px]" />
      </div>
    );
  }
  return (
    <div className={`photo-bw grain relative overflow-hidden bg-ink2 ${className}`}>
      <Image src={project.cover} alt={project.title} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
    </div>
  );
}

function Meta({ project }: { project: Project }) {
  return (
    <p className="eyebrow mt-1 text-left">
      {project.year} · {project.location}
    </p>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="group border border-line bg-ink transition hover:border-gold/60">
      <Link href={`/work/${project.slug}`} className="block">
        <Cover project={project} className="aspect-[4/3]" />
        <div className="p-5">
          <Meta project={project} />
          <h3 className="mt-2 text-lg font-extrabold text-sand">{project.title}</h3>
          <p className="mt-1 text-sm text-gold">{project.client}</p>
          <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted">{project.summary}</p>
          {project.metrics && (
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
              {project.metrics.map((m) => (
                <div key={m.label}>
                  <dt className="num text-xl font-bold text-sand">{m.value}</dt>
                  <dd className="mt-0.5 text-[11px] leading-4 text-muted">{m.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </Link>
    </article>
  );
}

export function FeaturedProject({ project, index }: { project: Project; index: number }) {
  const flip = index % 2 === 1;
  return (
    <article className={`grid border border-line bg-ink md:grid-cols-5 ${flip ? "md:[&>*:first-child]:order-last" : ""}`}>
      <Link href={`/work/${project.slug}`} className="block md:col-span-3">
        <Cover project={project} className="aspect-[16/10] h-full" />
      </Link>
      <div className="flex flex-col p-6 md:col-span-2 md:p-8">
        <span className="rule-dot" aria-hidden />
        <Meta project={project} />
        <h3 className="mt-3 text-2xl font-extrabold leading-snug text-sand">{project.title}</h3>
        <p className="mt-1 text-sm text-gold">{project.client}</p>
        <p className="mt-4 text-sm leading-8 text-muted">{project.summary}</p>
        {project.metrics && (
          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
            {project.metrics.map((m) => (
              <div key={m.label}>
                <div className="num text-2xl font-bold text-sand">{m.value}</div>
                <div className="mt-0.5 text-[11px] leading-4 text-muted">{m.label}</div>
              </div>
            ))}
          </div>
        )}
        <Link href={`/work/${project.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-gold hover:underline">
          تفاصيل المشروع <ArrowUpLeft size={16} />
        </Link>
      </div>
    </article>
  );
}

export function WorkCta() {
  return (
    <Link href="/work" className="btn-line">
      شاهد جميع الأعمال <ArrowUpLeft size={16} />
    </Link>
  );
}
