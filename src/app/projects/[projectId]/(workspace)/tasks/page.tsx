import { getProjectContext } from "@/lib/project";
import type { MilestoneRow, ScopeItemRow, TaskRow } from "@/lib/types";
import { MilestonesPanel } from "./milestones-panel";
import { TaskBoard } from "./task-board";

export default async function TasksPage({ params, searchParams }: PageProps<"/projects/[projectId]/tasks">) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { supabase, canEdit, members, userId } = await getProjectContext(projectId);

  const [{ data: tasks }, { data: milestones }, { data: scope }] = await Promise.all([
    supabase.from("tasks").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("milestones").select("*").eq("project_id", projectId).order("due_date", { nullsFirst: false }),
    supabase.from("scope_items").select("*").eq("project_id", projectId).order("sort_order"),
  ]);
  const t = (tasks as TaskRow[]) ?? [];
  const counts: Record<string, { open: number; total: number }> = {};
  t.forEach((x) => {
    if (!x.milestone_id) return;
    const c = (counts[x.milestone_id] ??= { open: 0, total: 0 });
    c.total += 1;
    if (x.status !== "done") c.open += 1;
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <TaskBoard
        projectId={projectId}
        tasks={t}
        members={members}
        milestones={(milestones as MilestoneRow[]) ?? []}
        scopeItems={(scope as ScopeItemRow[]) ?? []}
        userId={userId}
        canEdit={canEdit}
        initialMine={sp.mine === "1"}
      />
      <MilestonesPanel projectId={projectId} milestones={(milestones as MilestoneRow[]) ?? []} taskCounts={counts} canEdit={canEdit} />
    </div>
  );
}
