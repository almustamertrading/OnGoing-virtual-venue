import Link from "next/link";
import { connection } from "next/server";
import { ActivityList } from "@/components/activity-list";
import { getProjectContext } from "@/lib/project";
import { formatDate, isOverdue } from "@/lib/format";
import type { ActivityRow, ClientRow, MilestoneRow, ScopeItemRow, TaskRow } from "@/lib/types";
import { ProjectDetails } from "./project-details";
import { DeleteProjectButton } from "./delete-project-button";

export const metadata = { title: "نظرة عامة على المشروع | OnGoing" };

export default async function OverviewPage({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  // Overdue counts depend on today's date, so render at request time (Cache Components rule).
  await connection();
  const ctx = await getProjectContext(projectId);
  const { supabase, project, client, members, canEdit, isOwner, organization } = ctx;

  const [{ data: tasks }, { data: milestones }, { data: scope }, { data: activity }, { data: clients }] = await Promise.all([
    supabase.from("tasks").select("id, status, due_date, assignee_id").eq("project_id", projectId),
    supabase.from("milestones").select("*").eq("project_id", projectId).order("due_date", { nullsFirst: false }),
    supabase.from("scope_items").select("id, kind, status").eq("project_id", projectId),
    supabase.from("activity").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(8),
    supabase.from("clients").select("*").eq("organization_id", project.organization_id).order("name"),
  ]);

  const t = (tasks as Pick<TaskRow, "id" | "status" | "due_date" | "assignee_id">[]) ?? [];
  const done = t.filter((x) => x.status === "done").length;
  const blocked = t.filter((x) => x.status === "blocked").length;
  const overdue = t.filter((x) => isOverdue(x.due_date, x.status === "done")).length;
  const mine = t.filter((x) => x.assignee_id === ctx.userId && x.status !== "done").length;
  const s = (scope as Pick<ScopeItemRow, "id" | "kind" | "status">[]) ?? [];
  const deliverables = s.filter((x) => x.kind === "deliverable");
  const upcoming = ((milestones as MilestoneRow[]) ?? []).filter((m) => !m.done).slice(0, 4);
  const people = new Map(members.map((m) => [m.user_id, m.email]));
  const pct = t.length ? Math.round((done / t.length) * 100) : 0;

  const stats: { label: string; value: string; tone?: string; href: string }[] = [
    { label: "Tasks done", value: `${done} of ${t.length}`, href: "tasks" },
    { label: "Assigned to you", value: String(mine), href: "tasks?mine=1" },
    { label: "Overdue", value: String(overdue), tone: overdue ? "text-red-300" : undefined, href: "tasks" },
    { label: "Blocked", value: String(blocked), tone: blocked ? "text-amber-300" : undefined, href: "tasks" },
    {
      label: "Deliverables done",
      value: `${deliverables.filter((x) => x.status === "done").length} of ${deliverables.length}`,
      href: "scope",
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Project progress">
          {stats.map((x) => (
            <Link key={x.label} href={`/projects/${projectId}/${x.href}`} className="card p-3 hover:border-slate-600">
              <p className="text-xs text-slate-500">{x.label}</p>
              <p className={`mt-1 text-lg font-semibold ${x.tone ?? "text-white"}`}>{x.value}</p>
            </Link>
          ))}
        </section>
        <div className="h-1.5 overflow-hidden rounded bg-slate-800" title={`${pct}% of tasks done`}>
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>

        <ProjectDetails
          project={project}
          client={client}
          clients={(clients as ClientRow[]) ?? []}
          canEdit={canEdit}
          isOwner={isOwner}
          currency={organization?.currency ?? "SAR"}
        />

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Recent activity</h2>
            <Link href={`/projects/${projectId}/activity`} className="text-xs text-emerald-400 hover:underline">See all</Link>
          </div>
          <ActivityList items={(activity as ActivityRow[]) ?? []} people={people} />
        </section>
      </div>

      <aside className="space-y-6">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Next milestones</h2>
            <Link href={`/projects/${projectId}/tasks`} className="text-xs text-emerald-400 hover:underline">Manage</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">No open milestones.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcoming.map((m) => (
                <li key={m.id} className="flex justify-between gap-3">
                  <span className="text-slate-200">{m.title}</span>
                  <span className={isOverdue(m.due_date, m.done) ? "text-red-300" : "text-slate-400"}>
                    {m.due_date ? formatDate(m.due_date) : "No date"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Team</h2>
            <Link href={`/projects/${projectId}/team`} className="text-xs text-emerald-400 hover:underline">Manage</Link>
          </div>
          <ul className="space-y-2 text-sm">
            {members.map((m) => (
              <li key={m.user_id}>
                <p className="text-slate-200">{m.email}</p>
                <p className="text-xs text-slate-500">
                  <span className="capitalize">{m.role}</span>
                  {m.responsibility ? ` · ${m.responsibility}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {isOwner && <DeleteProjectButton projectId={projectId} />}
      </aside>
    </div>
  );
}
