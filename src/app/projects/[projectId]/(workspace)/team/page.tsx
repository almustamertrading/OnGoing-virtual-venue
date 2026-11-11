import { getProjectContext } from "@/lib/project";
import { MembersPanel } from "./members-panel";

export const metadata = { title: "الفريق | OnGoing" };

export default async function TeamPage({ params }: PageProps<"/projects/[projectId]/team">) {
  const { projectId } = await params;
  const { members, isOwner, userId } = await getProjectContext(projectId);
  return <MembersPanel projectId={projectId} members={members} isOwner={isOwner} currentUserId={userId} />;
}
