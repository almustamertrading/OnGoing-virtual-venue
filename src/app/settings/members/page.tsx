import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
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
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? "";

  const header = (
    <AppHeader email={email}>
      <Link href="/projects" className="hover:text-white">Projects</Link>
      <ChevronRight size={14} />
      <span className="text-slate-200">الأعضاء والصلاحيات</span>
    </AppHeader>
  );

  if (!org?.access.isAdmin) {
    return (
      <>
        {header}
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
          <Restricted title="هذه الصفحة لمدير المنظمة">إدارة الأعضاء والصلاحيات متاحة لمدير المنظمة فقط.</Restricted>
        </main>
      </>
    );
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
      {header}
      <main dir="rtl" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-semibold text-white">الأعضاء والصلاحيات</h1>
        <p className="mt-1 text-sm text-slate-400">
          {org.name} · يُطبَّق كل تغيير فورًا في قاعدة البيانات، وليس في الواجهة فقط.
        </p>
        <MembersTable organizationId={org.id} members={members} />
      </main>
    </>
  );
}
