import { redirect } from "next/navigation";
import { Restricted } from "@/components/restricted";
import { getMyOrganization } from "@/lib/project";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/types";
import { MembersTable, type MemberEntry } from "./members-table";

export const metadata = { title: "الأعضاء والصلاحيات | OnGoing" };

export default async function MembersPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/settings/members");
  const org = await getMyOrganization();
  const supabase = await createClient();

  if (!org?.access.isAdmin) {
    return <Restricted title="هذه الصفحة لمدير المنظمة">إدارة الأعضاء والصلاحيات متاحة لمدير المنظمة فقط.</Restricted>;
  }

  const { data: rows } = await supabase
    .from("organization_members")
    .select("user_id, role, capabilities, created_at")
    .eq("organization_id", org.id)
    .order("created_at");
  const ids = (rows ?? []).map((r) => r.user_id as string);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email, display_name").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as { email: string; display_name: string | null }]));

  const members: MemberEntry[] = (rows ?? []).map((r) => ({
    userId: r.user_id as string,
    email: byId.get(r.user_id as string)?.email ?? "—",
    name: byId.get(r.user_id as string)?.display_name ?? null,
    role: r.role as OrgRole,
    capabilities: (r.capabilities as string[]) ?? [],
    isSelf: r.user_id === userId,
  }));

  return (
    <>
      <h1 className="text-2xl font-semibold text-white">الأعضاء والصلاحيات</h1>
      <p className="mt-1 text-sm text-slate-400">
        {org.name} · يُطبَّق كل تغيير فورًا في قاعدة البيانات، وليس في الواجهة فقط.
      </p>
      <MembersTable organizationId={org.id} members={members} />
    </>
  );
}
