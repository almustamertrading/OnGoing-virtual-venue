import { AiFindingsPanel } from "@/components/ai-findings-panel";
import { getAiStatus } from "@/lib/ai/status";
import { todayIso } from "@/lib/format";
import { getProjectContext } from "@/lib/project";
import { KIND_LABEL, REGISTER_KINDS } from "@/lib/tender";
import type { AiFindingRow, ProjectRequirementRow } from "@/lib/types";
import { rejectFinding, reopenFinding } from "@/lib/ai/review-actions";
import { acceptFinding } from "./actions";
import { RequirementsRegister } from "./requirements-register";
import { TenderAnalysisPanel } from "./tender-analysis-panel";

export default async function RequirementsPage({ params }: PageProps<"/projects/[projectId]/requirements">) {
  const { projectId } = await params;
  const { supabase, canEdit, members, project } = await getProjectContext(projectId);

  const [{ data: rows }, { data: findings }, { data: docs }] = await Promise.all([
    supabase.from("project_requirements").select("*").eq("project_id", projectId).order("sort_order").order("created_at"),
    supabase
      .from("ai_findings").select("*").eq("project_id", projectId).eq("workflow", "tender")
      .order("created_at", { ascending: false }).limit(300),
    supabase
      .from("documents").select("id, title, file_name, mime_type, category").eq("project_id", projectId)
      .order("created_at", { ascending: false }).limit(500),
  ]);
  const documents = (docs ?? []) as { id: string; title: string; file_name: string; mime_type: string | null; category: string }[];
  const pdfs = documents.filter((d) => String(d.mime_type ?? "").includes("pdf") || d.file_name.toLowerCase().endsWith(".pdf"));
  const findingRows = (findings as AiFindingRow[]) ?? [];

  // Reviewer names: project members plus anyone else who reviewed (e.g. an organisation admin).
  const people: Record<string, string> = Object.fromEntries(members.map((m) => [m.user_id, m.email]));
  const missing = [...new Set(findingRows.map((f) => f.reviewed_by).filter((v): v is string => Boolean(v) && !(v! in people)))];
  if (missing.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, email, display_name").in("id", missing);
    for (const p of (profiles as { id: string; email: string; display_name: string | null }[]) ?? []) people[p.id] = p.display_name || p.email;
  }
  const aiStatus = canEdit ? await getAiStatus(supabase, "tender_analysis") : null;

  return (
    <div dir="rtl" lang="ar" className="space-y-5">
      {canEdit && aiStatus && (
        <TenderAnalysisPanel projectId={projectId} documents={pdfs.map((d) => ({ id: d.id, title: d.title, category: d.category }))} status={aiStatus} />
      )}
      <AiFindingsPanel
        title="نتائج التحليل للمراجعة"
        findings={findingRows}
        kindLabel={KIND_LABEL}
        documents={Object.fromEntries(documents.map((d) => [d.id, d.title]))}
        people={people}
        canReview={canEdit}
        acceptLabels={Object.fromEntries([...REGISTER_KINDS].map((k) => [k, "إضافة إلى السجل"]))}
        defaultAcceptLabel="اعتماد"
        copyKinds={["clarification"]}
        emptyText="لا نتائج بانتظار المراجعة. شغّل التحليل على ملف الكراسة لاقتراح المتطلبات."
        onAccept={acceptFinding}
        onReject={rejectFinding}
        onReopen={reopenFinding}
      />
      <RequirementsRegister
        projectId={projectId}
        organizationId={project.organization_id}
        rows={(rows as ProjectRequirementRow[]) ?? []}
        members={members}
        documents={documents.map((d) => ({ id: d.id, title: d.title }))}
        canEdit={canEdit}
        today={todayIso()}
      />
    </div>
  );
}
