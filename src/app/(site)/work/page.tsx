import type { Metadata } from "next";
import { ProjectCard } from "@/components/site/project-card";
import { company, projects, stats } from "@/lib/site-content";

export const metadata: Metadata = {
  title: `أعمالنا | ${company.nameAr}`,
  description: "نماذج من مشاريع مشهد المستقبل المنفّذة في المملكة العربية السعودية.",
};

export default function WorkPage() {
  return (
    <>
      <section className="border-b border-white/10 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(245,158,11,0.14),transparent_70%)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
          <h1 className="text-3xl font-extrabold text-white sm:text-5xl">أعمالنا</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-300">
            مشاريع نفّذناها على أرض الواقع، من المفهوم حتى التشغيل، في الفعاليات الثقافية والترفيهية والمعارض.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
            {stats.map((s) => (
              <div key={s.label}>
                <span className="text-2xl font-extrabold text-amber-400">{s.value}</span>{" "}
                <span className="text-xs text-stone-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </section>
    </>
  );
}
