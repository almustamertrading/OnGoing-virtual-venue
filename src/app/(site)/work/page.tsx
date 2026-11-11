import type { Metadata } from "next";
import { ProjectCard } from "@/components/site/project-card";
import { company, projects, stats } from "@/lib/site-content";

export const metadata: Metadata = {
  title: `أعمالنا | ${company.nameEn}`,
  description: "مشاريع نفّذتها Ongoing Events في المملكة العربية السعودية، من المفهوم حتى التشغيل.",
};

export default function WorkPage() {
  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
          <p className="eyebrow text-left">Work</p>
          <h1 className="mt-3 text-4xl font-extrabold text-sand sm:text-5xl">أعمالنا</h1>
          <span className="rule-dot mt-6" aria-hidden />
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            مشاريع نفّذناها على أرض الواقع، من المفهوم حتى التشغيل، في الفعاليات الثقافية والترفيهية والمعارض والمؤتمرات.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <span dir="ltr" className="num block text-3xl font-bold text-gold">{s.value}</span>
                <span className="mt-1 block text-xs leading-5 text-muted">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </section>
    </>
  );
}
