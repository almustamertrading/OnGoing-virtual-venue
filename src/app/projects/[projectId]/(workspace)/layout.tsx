import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { LiveRefresh } from "@/components/live-refresh";
import { StatusBadge } from "@/components/status-badge";
import { getProjectContext } from "@/lib/project";
import { PROJECT_TYPE, formatRange } from "@/lib/format";
import { WorkspaceTabs } from "./workspace-tabs";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { project, client, email, members, supabase, organization, canSeeFinance } = await getProjectContext(projectId);

  const [
    { count: openTasks },
    { count: venues },
    { count: scope },
    { count: plan },
    { count: pricing },
    { count: structure },
    { count: evaluation },
    { count: layoutsCount },
    { count: rfqsCount },
    { count: invoicesCount },
    { count: inventoryCount },
    { count: documentsCount },
  ] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId).neq("status", "done"),
    supabase.from("venues").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("scope_items").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("plan_phases").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("boq_items").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("team_roles").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("evaluation_criteria").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("layouts").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("rfqs").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    canSeeFinance
      ? supabase.from("invoices").select("id", { count: "exact", head: true }).eq("project_id", projectId)
      : Promise.resolve({ count: 0 }),
    organization
      ? supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("organization_id", organization.id)
      : Promise.resolve({ count: 0 }),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("project_id", projectId),
  ]);

  return (
    <>
      <AppHeader email={email}>
        <Link href="/projects" className="hover:text-white">Projects</Link>
        <ChevronRight size={14} />
        <span className="truncate text-slate-200">{project.code}</span>
      </AppHeader>
      <LiveRefresh projectId={projectId} />
      <div className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto w-full max-w-6xl px-4 pt-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-slate-500">{project.code} · {PROJECT_TYPE[project.project_type]}</p>
              <h1 className="mt-1 truncate text-2xl font-semibold text-white">{project.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                <span>{client?.name ?? "No client yet"}</span>
                {(project.start_date || project.end_date) && (
                  <span className="flex items-center gap-1"><CalendarDays size={14} />{formatRange(project.start_date, project.end_date)}</span>
                )}
                {project.location && <span className="flex items-center gap-1"><MapPin size={14} />{project.location}</span>}
              </p>
            </div>
            <StatusBadge status={project.status} />
          </div>
          <div className="mt-4">
            <WorkspaceTabs
              projectId={projectId}
              hidden={canSeeFinance ? [] : ["finance"]}
              counts={{
                tasks: openTasks ?? 0,
                venues: venues ?? 0,
                scope: scope ?? 0,
                plan: plan ?? 0,
                pricing: pricing ?? 0,
                structure: structure ?? 0,
                evaluation: evaluation ?? 0,
                layouts: layoutsCount ?? 0,
                procurement: rfqsCount ?? 0,
                finance: invoicesCount ?? 0,
                inventory: inventoryCount ?? 0,
                documents: documentsCount ?? 0,
                team: members.length,
              }}
            />
          </div>
        </div>
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
