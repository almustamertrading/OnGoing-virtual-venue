import { getProjectContext } from "@/lib/project";
import type { ScopeItemRow } from "@/lib/types";
import { ScopeList } from "./scope-list";

export const metadata = { title: "النطاق | OnGoing" };

export default async function ScopePage({ params }: PageProps<"/projects/[projectId]/scope">) {
  const { projectId } = await params;
  const { supabase, canEdit } = await getProjectContext(projectId);
  const { data } = await supabase
    .from("scope_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  const items = (data as ScopeItemRow[]) ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ScopeList projectId={projectId} kind="scope" items={items.filter((i) => i.kind === "scope")} canEdit={canEdit} />
      <ScopeList projectId={projectId} kind="deliverable" items={items.filter((i) => i.kind === "deliverable")} canEdit={canEdit} />
    </div>
  );
}
