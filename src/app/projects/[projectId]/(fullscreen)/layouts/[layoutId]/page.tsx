import { notFound } from "next/navigation";
import { getProjectContext } from "@/lib/project";
import type { LayoutRow } from "@/lib/types";
import { LayoutEditor } from "@/components/editor/layout-editor";

export const metadata = { title: "محرر المخطط | OnGoing" };

export default async function LayoutEditorPage({ params }: PageProps<"/projects/[projectId]/layouts/[layoutId]">) {
  const { projectId, layoutId } = await params;
  const { supabase, project, role, email } = await getProjectContext(projectId);
  const { data: layout } = await supabase
    .from("layouts")
    .select("*")
    .eq("id", layoutId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!layout || !role) notFound();

  return (
    <LayoutEditor
      projectId={projectId}
      projectName={`${project.code} ${project.name}`}
      layout={layout as LayoutRow}
      canEdit={role === "owner" || role === "editor"}
      email={email}
    />
  );
}
