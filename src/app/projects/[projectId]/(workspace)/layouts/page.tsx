import { getProjectContext } from "@/lib/project";
import type { LayoutRow, VenueRow } from "@/lib/types";
import { LayoutsList } from "./layouts-list";

export default async function LayoutsPage({ params }: PageProps<"/projects/[projectId]/layouts">) {
  const { projectId } = await params;
  const { supabase, canEdit } = await getProjectContext(projectId);
  const [{ data: layouts }, { data: venues }] = await Promise.all([
    supabase.from("layouts").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("venues").select("*").eq("project_id", projectId).order("created_at"),
  ]);

  return (
    <LayoutsList
      projectId={projectId}
      layouts={(layouts as LayoutRow[]) ?? []}
      venues={(venues as VenueRow[]) ?? []}
      canEdit={canEdit}
    />
  );
}
