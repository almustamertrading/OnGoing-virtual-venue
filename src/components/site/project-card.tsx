import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import type { Project } from "@/lib/site-content";

export function ProjectCard({ project, large = false }: { project: Project; large?: boolean }) {
  return (
    <article className={`group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition hover:border-emerald-400/40 ${large ? "" : ""}`}>
      <div className={`relative flex items-end bg-gradient-to-br ${project.accent} ${large ? "h-44" : "h-36"} p-4`}>
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.25)_1px,transparent_0)] [background-size:18px_18px]" />
        <div className="relative">
          <span className="rounded-full bg-black/50 px-2.5 py-1 text-xs text-white backdrop-blur">{project.year} · {project.location}</span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-extrabold text-white">{project.title}</h3>
        <p className="mt-1 text-sm text-emerald-300/90">{project.client}</p>
        <p className="mt-3 text-sm leading-7 text-slate-400">{project.summary}</p>
        {project.metrics && (
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
            {project.metrics.map((m) => (
              <div key={m.label} className="text-center">
                <dt className="text-base font-extrabold text-white">{m.value}</dt>
                <dd className="mt-0.5 text-[11px] leading-4 text-slate-500">{m.label}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </article>
  );
}

export function FeaturedProject({ project }: { project: Project }) {
  return (
    <article className="group grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] md:grid-cols-2">
      <div className={`relative min-h-48 bg-gradient-to-br ${project.accent} p-6`}>
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.25)_1px,transparent_0)] [background-size:18px_18px]" />
        <span className="relative rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur">{project.year} · {project.location}</span>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-extrabold text-white">{project.title}</h3>
        <p className="mt-1 text-sm text-emerald-300/90">{project.client}</p>
        <p className="mt-3 text-sm leading-7 text-slate-400">{project.summary}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
          {project.highlights.map((h) => (
            <li key={h} className="flex items-start gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />{h}</li>
          ))}
        </ul>
        {project.metrics && (
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            {project.metrics.map((m) => (
              <div key={m.label}>
                <span className="text-lg font-extrabold text-white">{m.value}</span>{" "}
                <span className="text-xs text-slate-500">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function WorkCta() {
  return (
    <Link href="/work" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400">
      شاهد جميع الأعمال <ArrowUpLeft size={16} />
    </Link>
  );
}
