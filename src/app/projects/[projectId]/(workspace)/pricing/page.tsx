import { AiFindingsPanel } from "@/components/ai-findings-panel";
import { rejectFinding, reopenFinding } from "@/lib/ai/review-actions";
import { getAiStatus } from "@/lib/ai/status";
import { BOQ_KIND_LABEL } from "@/lib/boq-extract";
import { getProjectContext } from "@/lib/project";
import type { AiFindingRow, BoqItemRow } from "@/lib/types";
import { acceptBoqFinding } from "./actions";
import { BoqExtractPanel } from "./boq-extract-panel";
import { PricingTable } from "./pricing-table";

export const metadata = { title: "التسعير وجدول الكميات | OnGoing" };

export default async function PricingPage({ params }: PageProps<"/projects/[projectId]/pricing">) {
  const { projectId } = await params;
  const { supabase, canEdit, organization, members } = await getProjectContext(projectId);
  const [{ data }, { data: findings }, { data: docs }] = await Promise.all([
    supabase.from("boq_items").select("*").eq("project_id", projectId).order("sort_order"),
    supabase
      .from("ai_findings").select("*").eq("project_id", projectId).eq("workflow", "boq")
      .order("source_page", { ascending: true, nullsFirst: false }).order("created_at").limit(400),
    supabase
      .from("documents").select("id, title, file_name, mime_type, category").eq("project_id", projectId)
      .order("created_at", { ascending: false }).limit(500),
  ]);
  const items = (data as BoqItemRow[]) ?? [];
  const findingRows = (findings as AiFindingRow[]) ?? [];
  const documents = (docs ?? []) as { id: string; title: string; file_name: string; mime_type: string | null; category: string }[];
  const pdfs = documents.filter((d) => String(d.mime_type ?? "").includes("pdf") || d.file_name.toLowerCase().endsWith(".pdf"));
  const people: Record<string, string> = Object.fromEntries(members.map((m) => [m.user_id, m.email]));
  const aiStatus = canEdit ? await getAiStatus(supabase, "boq_extract") : null;

  return (
    <div dir="rtl" lang="ar" className="space-y-5">
      {canEdit && aiStatus && (
        <BoqExtractPanel projectId={projectId} documents={pdfs.map((d) => ({ id: d.id, title: d.title, category: d.category }))} status={aiStatus} />
      )}
      {(findingRows.length > 0 || canEdit) && (
        <AiFindingsPanel
          title="بنود مستخرجة بانتظار التحقق"
          findings={findingRows}
          kindLabel={BOQ_KIND_LABEL}
          documents={Object.fromEntries(documents.map((d) => [d.id, d.title]))}
          people={people}
          canReview={canEdit}
          acceptLabels={{ boq_line: "تحقّقت: أضف إلى الجدول" }}
          emptyText="لا بنود بانتظار التحقق. استخرج البنود من ملف الكراسة أو أضفها يدويًا في الجدول."
          onAccept={acceptBoqFinding}
          onReject={rejectFinding}
          onReopen={reopenFinding}
        />
      )}
      <PricingTable projectId={projectId} items={items} canEdit={canEdit} currency={organization?.currency ?? "SAR"} />
    </div>
  );
}
