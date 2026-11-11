import { DocumentFiltersForm } from "@/app/documents/document-filters";
import { DocumentLibrary } from "@/app/documents/document-library";
import { getProjectContext } from "@/lib/project";
import {
  MAX_LISTED_DOCUMENTS,
  filterDocuments,
  hasActiveFilters,
  parseDocumentFilters,
  toListItems,
  type DocumentViewer,
} from "@/lib/documents";
import type { DocumentRow } from "@/lib/types";

export const metadata = { title: "مستندات المشروع | OnGoing" };

export default async function ProjectDocumentsPage({ params, searchParams }: PageProps<"/projects/[projectId]/documents">) {
  const { projectId } = await params;
  const { supabase, project, members, canEdit, canSeeFinance } = await getProjectContext(projectId);
  const filters = { ...parseDocumentFilters(await searchParams), projectId: null, orgOnly: false };

  // RLS returns this project's documents to its members; confidential ones only with finance access.
  const { data: rows, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(MAX_LISTED_DOCUMENTS);
  const docs = (rows as DocumentRow[] | null) ?? [];

  // Uploaders are usually project members; anyone else (e.g. an organisation admin) comes from profiles.
  const emails = new Map(members.map((m) => [m.user_id, m.email]));
  const missing = [...new Set(docs.map((d) => d.created_by))].filter((id) => !emails.has(id));
  if (missing.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", missing);
    for (const p of (profiles as { id: string; email: string }[] | null) ?? []) emails.set(p.id, p.email);
  }

  const viewer: DocumentViewer = {
    organizationId: project.organization_id,
    canContribute: false,
    // Same rule as private.can_access_project_finance (project member or admin, with finance access).
    finance: canSeeFinance,
    editableProjectIds: new Set(canEdit ? [projectId] : []),
  };
  const items = toListItems(docs, filterDocuments(docs, filters), { emails, projectLabels: new Map(), viewer });

  return (
    <div dir="rtl" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">مستندات المشروع</h2>
        <p className="mt-1 text-sm text-slate-400">
          العقود والمخططات والتصاريح وغيرها، بأحدث إصدار لكل مستند.{" "}
          {canEdit ? "يمكنك رفع مستندات وإصدارات جديدة." : "لديك صلاحية القراءة والتنزيل فقط."}
        </p>
      </div>
      <DocumentFiltersForm basePath={`/projects/${projectId}/documents`} filters={filters} />
      {error && <p role="alert" className="text-sm text-red-400">تعذّر تحميل المستندات: {error.message}</p>}
      <DocumentLibrary
        items={items}
        showProject={false}
        upload={canEdit ? { scope: { organizationId: project.organization_id, projectId }, canMarkConfidential: canSeeFinance } : null}
        emptyText={hasActiveFilters(filters) ? "لا توجد مستندات مطابقة. جرّب تعديل البحث أو مسح الفلاتر." : "لا توجد مستندات لهذا المشروع بعد."}
      />
    </div>
  );
}
