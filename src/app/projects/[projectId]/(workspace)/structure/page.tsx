import { getProjectContext } from "@/lib/project";
import type { TeamRoleRow } from "@/lib/types";
import { StructureList } from "./structure-list";

export const metadata = { title: "الهيكل | OnGoing" };

export default async function StructurePage({ params }: PageProps<"/projects/[projectId]/structure">) {
  const { projectId } = await params;
  const { supabase, canEdit } = await getProjectContext(projectId);
  const { data } = await supabase
    .from("team_roles")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  const roles = (data as TeamRoleRow[]) ?? [];

  return <StructureList projectId={projectId} roles={roles} canEdit={canEdit} />;
}
