import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { accessFor } from "@/lib/permissions";
import type { ClientRow, MemberRole, MemberRow, OrgRole, ProjectRow } from "@/lib/types";

/** Everything a workspace page needs about the project and the viewer. Loaded once per request. */
export const getProjectContext = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string;
  const email = (claims?.claims?.email as string | undefined) ?? "";

  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) notFound();

  const [{ data: client }, { data: memberRows }, { data: orgMember }, { data: org }] = await Promise.all([
    project.client_id
      ? supabase.from("clients").select("*").eq("id", project.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("project_members").select("user_id, role, responsibility").eq("project_id", projectId),
    supabase
      .from("organization_members")
      .select("role, capabilities")
      .eq("organization_id", project.organization_id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("organizations").select("id, name, currency").eq("id", project.organization_id).maybeSingle(),
  ]);

  const ids = (memberRows ?? []).map((m) => m.user_id as string);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email").in("id", ids)
    : { data: [] as { id: string; email: string }[] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id as string, p.email as string]));

  const members: MemberRow[] = (memberRows ?? []).map((m) => ({
    user_id: m.user_id as string,
    role: m.role as MemberRole,
    responsibility: (m.responsibility as string) ?? "",
    email: emailById.get(m.user_id as string) ?? "Unknown user",
  }));

  const orgRole = (orgMember?.role as OrgRole | undefined) ?? null;
  const projectRole = members.find((m) => m.user_id === userId)?.role ?? null;
  const isOrgAdmin = orgRole === "admin";
  const role: MemberRole | null = isOrgAdmin ? "owner" : projectRole;
  const access = accessFor(orgRole, orgMember?.capabilities as string[] | undefined);

  return {
    supabase,
    userId,
    email,
    project: project as ProjectRow,
    client: (client as ClientRow | null) ?? null,
    organization: org as { id: string; name: string; currency: string } | null,
    members,
    orgRole,
    role,
    access,
    canEdit: role === "owner" || role === "editor",
    isOwner: role === "owner",
    /** Same rule as private.can_access_project_finance: a project member (or org admin) with finance_access. */
    canSeeFinance: access.finance && role !== null,
  };
});

/** The organisation the signed-in user belongs to, if any. */
export const getMyOrganization = cache(async () => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string;
  const { data } = await supabase
    .from("organization_members")
    .select("role, capabilities, organizations(id, name, currency)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const org = data.organizations as unknown as { id: string; name: string; currency: string };
  return { ...org, role: data.role as OrgRole, access: accessFor(data.role as OrgRole, data.capabilities as string[]) };
});
