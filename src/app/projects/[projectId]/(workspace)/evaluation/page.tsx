import { getProjectContext } from "@/lib/project";
import type { EvaluationCriterionRow } from "@/lib/types";
import { KpiList } from "./kpi-list";

export default async function EvaluationPage({ params }: PageProps<"/projects/[projectId]/evaluation">) {
  const { projectId } = await params;
  const { supabase, canEdit } = await getProjectContext(projectId);
  const { data } = await supabase
    .from("evaluation_criteria")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  const criteria = (data as EvaluationCriterionRow[]) ?? [];

  return <KpiList projectId={projectId} criteria={criteria} canEdit={canEdit} />;
}
