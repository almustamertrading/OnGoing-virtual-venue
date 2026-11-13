import { ActivityList } from "@/components/activity-list";
import { getProjectContext } from "@/lib/project";
import type { ActivityRow } from "@/lib/types";

export default async function ActivityPage({ params }: PageProps<"/projects/[projectId]/activity">) {
  const { projectId } = await params;
  const { supabase, members } = await getProjectContext(projectId);
  const { data } = await supabase
    .from("activity")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);

  // People who acted but have since left the team still get a name.
  const rows = (data as ActivityRow[]) ?? [];
  const people = new Map(members.map((m) => [m.user_id, m.email]));
  const missing = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id && !people.has(id)))];
  if (missing.length) {
    const { data: extra } = await supabase.from("profiles").select("id, email").in("id", missing);
    (extra ?? []).forEach((p) => people.set(p.id as string, p.email as string));
  }

  return (
    <section className="card max-w-3xl p-5">
      <h2 className="mb-1 font-semibold text-slate-100">Activity</h2>
      <p className="mb-5 text-xs text-slate-500">Every change to this project, newest first. Times are Riyadh time.</p>
      <ActivityList items={rows} people={people} grouped />
    </section>
  );
}
