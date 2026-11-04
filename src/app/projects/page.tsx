import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganization } from "@/lib/project";
import { PROJECT_STATUS, PROJECT_TYPE, formatRange } from "@/lib/format";
import type { ClientRow, ProjectRow, ProjectStatus } from "@/lib/types";
import { CreateProject } from "./create-project";

const ACTIVE: ProjectStatus[] = ["lead", "proposal", "confirmed", "in_progress", "on_hold"];

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const params = await searchParams;
  const filter = typeof params.status === "string" ? params.status : "active";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? null;
  const org = await getMyOrganization();

  const [{ data: projects, error }, { data: clients }, { data: openTasks }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .order("start_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    org
      ? supabase.from("clients").select("*").eq("organization_id", org.id).order("name")
      : Promise.resolve({ data: [] as ClientRow[] }),
    supabase.from("tasks").select("project_id").neq("status", "done"),
  ]);

  const clientName = new Map((clients ?? []).map((c) => [c.id as string, c.name as string]));
  const openByProject = new Map<string, number>();
  (openTasks ?? []).forEach((t) => openByProject.set(t.project_id, (openByProject.get(t.project_id) ?? 0) + 1));

  const all = (projects as ProjectRow[] | null) ?? [];
  const shown = all.filter((p) =>
    filter === "all" ? true : filter === "active" ? ACTIVE.includes(p.status) : p.status === filter,
  );
  const counts = new Map<string, number>();
  all.forEach((p) => counts.set(p.status, (counts.get(p.status) ?? 0) + 1));
  const activeCount = all.filter((p) => ACTIVE.includes(p.status)).length;

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "active", label: "Active", count: activeCount },
    ...(Object.keys(PROJECT_STATUS) as ProjectStatus[])
      .filter((s) => counts.get(s))
      .map((s) => ({ key: s, label: PROJECT_STATUS[s].label, count: counts.get(s) ?? 0 })),
    { key: "all", label: "All", count: all.length },
  ];

  return (
    <>
      <AppHeader email={email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Projects</h1>
            <p className="text-sm text-slate-400">{org ? org.name : "Projects you have been invited to"}</p>
          </div>
          {org && <CreateProject organizationId={org.id} clients={(clients as ClientRow[]) ?? []} />}
        </div>

        {!org && (
          <div className="card mb-6 p-4 text-sm text-slate-300">
            Your email is not part of a company account, so you can only see projects someone has shared with you.
          </div>
        )}

        <nav className="mb-4 flex flex-wrap gap-1" aria-label="Filter projects by status">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "active" ? "/projects" : `/projects?status=${t.key}`}
              className={`rounded-md px-3 py-1.5 text-sm ${filter === t.key ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {t.label} <span className="text-slate-500">{t.count}</span>
            </Link>
          ))}
        </nav>

        {error && <p className="text-sm text-red-400">{error.message}</p>}
        {shown.length === 0 && (
          <div className="card p-10 text-center text-slate-400">
            {all.length === 0 ? "No projects yet. Create the first one to get started." : "No projects with this status."}
          </div>
        )}

        <ul className="space-y-2">
          {shown.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition hover:border-emerald-700"
              >
                <span className="w-20 shrink-0 font-mono text-xs text-slate-500">{p.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{p.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                    <span>{p.client_id ? clientName.get(p.client_id) ?? "Client" : "No client"}</span>
                    <span>{PROJECT_TYPE[p.project_type]}</span>
                    {(p.start_date || p.end_date) && (
                      <span className="flex items-center gap-1"><CalendarDays size={12} />{formatRange(p.start_date, p.end_date)}</span>
                    )}
                    {p.location && <span className="flex items-center gap-1"><MapPin size={12} />{p.location}</span>}
                  </p>
                </div>
                <span className="text-xs text-slate-400">{openByProject.get(p.id) ?? 0} open tasks</span>
                <StatusBadge status={p.status} />
                <ChevronRight size={18} className="text-slate-500" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
