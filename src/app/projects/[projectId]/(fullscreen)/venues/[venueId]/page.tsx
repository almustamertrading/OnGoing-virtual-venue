import { notFound } from "next/navigation";
import { getProjectContext } from "@/lib/project";
import type { VenueRow } from "@/lib/types";
import { EditorLoader } from "@/components/editor/editor-loader";

export const metadata = { title: "خريطة المكان | OnGoing" };

export default async function VenuePage({ params }: PageProps<"/projects/[projectId]/venues/[venueId]">) {
  const { projectId, venueId } = await params;
  const { supabase, project, role, userId, email } = await getProjectContext(projectId);
  const { data: venue } = await supabase
    .from("venues")
    .select("*")
    .eq("id", venueId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!venue || !role) notFound();

  return (
    <EditorLoader
      projectId={projectId}
      projectName={`${project.code} ${project.name}`}
      venue={venue as VenueRow}
      role={role}
      userId={userId}
      email={email}
    />
  );
}
