import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { getMyOrganization } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_LISTED_DOCUMENTS,
  canContributeOrgDocuments,
  filterDocuments,
  hasActiveFilters,
  parseDocumentFilters,
  toListItems,
  type DocumentViewer,
} from "@/lib/documents";
import type { DocumentRow, MemberRole } from "@/lib/types";
import { DocumentFiltersForm } from "./document-filters";
import { DocumentLibrary } from "./document-library";

export const metadata = { title: "المستندات | OnGoing" };

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/documents");
  const email = (claims?.claims?.email as string | undefined) ?? "";

  const [filters, org] = await Promise.all([searchParams.then(parseDocumentFilters), getMyOrganization()]);

  // RLS decides what comes back: organisation documents for members, project documents for
  // project members, and confidential documents only for finance users.
  const [{ data: rows, error }, { data: projectRows }, { data: memberships }] = await Promise.all([
    supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(MAX_LISTED_DOCUMENTS),
    supabase.from("projects").select("id, organization_id, code, name").order("name"),
    supabase.from("project_members").select("project_id, role").eq("user_id", userId),
  ]);
  const docs = (rows as DocumentRow[] | null) ?? [];
  const projects = (projectRows as { id: string; organization_id: string; code: string; name: string }[] | null) ?? [];

  const uploaderIds = [...new Set(docs.map((d) => d.created_by))];
  const { data: profiles } = uploaderIds.length
    ? await supabase.from("profiles").select("id, email").in("id", uploaderIds)
    : { data: [] as { id: string; email: string }[] };

  const editable = new Set(
    ((memberships as { project_id: string; role: MemberRole }[] | null) ?? [])
      .filter((m) => m.role === "owner" || m.role === "editor")
      .map((m) => m.project_id),
  );
  // Organisation admins edit every project of their organisation.
  if (org?.access.isAdmin) for (const p of projects) if (p.organization_id === org.id) editable.add(p.id);
  const canContribute = org ? canContributeOrgDocuments(org.access) : false;
  const viewer: DocumentViewer = {
    organizationId: org?.id ?? null,
    canContribute,
    finance: org?.access.finance ?? false,
    editableProjectIds: editable,
  };

  const projectLabels = new Map(projects.map((p) => [p.id, `${p.code} · ${p.name}`]));
  const items = toListItems(docs, filterDocuments(docs, filters), {
    emails: new Map(((profiles as { id: string; email: string }[] | null) ?? []).map((p) => [p.id, p.email])),
    projectLabels,
    viewer,
  });
  const projectOptions = projects
    .filter((p) => p.id === filters.projectId || docs.some((d) => d.project_id === p.id))
    .map((p) => ({ id: p.id, label: projectLabels.get(p.id) ?? p.name }));

  return (
    <>
      <AppHeader email={email}>
        <Link href="/projects" className="hover:text-white">Projects</Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-slate-200">المستندات</span>
      </AppHeader>
      <main dir="rtl" className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">المستندات</h1>
          <p className="mt-1 text-sm text-slate-400">
            {org ? `${org.name} · ` : ""}مستندات المنظمة ومستندات المشاريع التي أنت عضو فيها، بأحدث إصدار لكل مستند.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {canContribute ? "مستندات المشروع تُرفع من تبويب Documents داخل المشروع. " : ""}
            {viewer.finance ? "" : "المستندات السرّية تظهر فقط لمن لديه صلاحية المالية."}
          </p>
        </div>

        {!org && (
          <div className="card p-4 text-sm text-slate-300">
            بريدك ليس ضمن حساب شركة، لذلك ترى فقط مستندات المشاريع التي دُعيت إليها.
          </div>
        )}

        <DocumentFiltersForm basePath="/documents" filters={filters} projects={projectOptions} />

        {error && <p role="alert" className="text-sm text-red-400">تعذّر تحميل المستندات: {error.message}</p>}

        <DocumentLibrary
          items={items}
          showProject
          upload={org && canContribute ? { scope: { organizationId: org.id, projectId: null }, canMarkConfidential: org.access.finance } : null}
          emptyText={hasActiveFilters(filters) ? "لا توجد مستندات مطابقة. جرّب تعديل البحث أو مسح الفلاتر." : "لا توجد مستندات بعد."}
        />
        {docs.length >= MAX_LISTED_DOCUMENTS && (
          <p className="text-xs text-amber-300/80">تُعرض أحدث {MAX_LISTED_DOCUMENTS} مستند فقط، والبحث يشملها وحدها.</p>
        )}
      </main>
    </>
  );
}
