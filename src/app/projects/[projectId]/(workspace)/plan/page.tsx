import { getProjectContext } from "@/lib/project";
import type { PlanPhaseRow } from "@/lib/types";
import { PlanList } from "./plan-list";

export const metadata = { title: "الخطة | OnGoing" };

export default async function PlanPage({ params }: PageProps<"/projects/[projectId]/plan">) {
  const { projectId } = await params;
  const { supabase, canEdit } = await getProjectContext(projectId);
  const { data } = await supabase
    .from("plan_phases")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  const phases = (data as PlanPhaseRow[]) ?? [];

  return <PlanList projectId={projectId} phases={phases} canEdit={canEdit} />;
}
