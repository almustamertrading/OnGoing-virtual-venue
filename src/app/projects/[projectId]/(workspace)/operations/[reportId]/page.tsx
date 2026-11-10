import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AiFindingsPanel } from "@/components/ai-findings-panel";
import { rejectFinding, reopenFinding } from "@/lib/ai/review-actions";
import { getAiStatus } from "@/lib/ai/status";
import { formatDate, todayIso } from "@/lib/format";
import { OPS_KIND_LABEL, OPS_REPORT_KIND } from "@/lib/ops";
import { getProjectContext } from "@/lib/project";
import type { AiFindingRow, OpsReportRow } from "@/lib/types";
import { acceptOpsFinding } from "../actions";
import { OpsExtractPanel, ReportForm } from "../operations-client";

export default async function OpsReportPage({ params }: PageProps<"/projects/[projectId]/operations/[reportId]">) {
  const { projectId, reportId } = await params;
  const { supabase, canEdit, members, project } = await getProjectContext(projectId);
  const { data } = await supabase.from("ops_reports").select("*").eq("id", reportId).eq("project_id", projectId).maybeSingle();
  const report = data as OpsReportRow | null;
  if (!report) notFound();

  const { data: findings } = await supabase
    .from("ai_findings").select("*").eq("project_id", projectId).eq("workflow", "operations").eq("data->>report_id", reportId)
    .order("created_at", { ascending: false });
  const people: Record<string, string> = Object.fromEntries(members.map((m) => [m.user_id, m.email]));
  const aiStatus = canEdit ? await getAiStatus(supabase, "ops_extract") : null;

  return (
    <div dir="rtl" lang="ar" className="space-y-5">
      <nav className="flex items-center gap-1 text-xs text-slate-400" aria-label="مسار التقرير">
        <Link href={`/projects/${projectId}/operations`} className="hover:text-white">العمليات</Link>
        <ChevronRight size={12} className="rotate-180" aria-hidden />
        <span className="text-slate-200">{OPS_REPORT_KIND[report.kind]} · <bdi>{formatDate(report.report_date)}</bdi></span>
      </nav>
      {canEdit ? (
        <ReportForm projectId={projectId} organizationId={project.organization_id} report={report} today={todayIso()} />
      ) : (
        <section className="card p-5" data-testid="report-view">
          <h2 className="font-semibold text-white">{report.title}</h2>
          <p className="mt-1 text-xs text-slate-400">{OPS_REPORT_KIND[report.kind]} · <bdi>{formatDate(report.report_date)}</bdi>{report.location && ` · ${report.location}`}</p>
          {report.attendees && <p className="mt-1 text-xs text-slate-400">الحضور: {report.attendees}</p>}
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200" dir="auto">{report.body}</p>
        </section>
      )}
      {canEdit && aiStatus && <OpsExtractPanel projectId={projectId} reportId={report.id} status={aiStatus} />}
      <AiFindingsPanel
        title="الإجراءات والمخاطر المقترحة"
        findings={(findings as AiFindingRow[]) ?? []}
        kindLabel={OPS_KIND_LABEL}
        documents={{}}
        sourceLabel="نص التقرير"
        people={people}
        canReview={canEdit}
        acceptLabels={{ action_item: "إنشاء مهمة", issue: "إضافة إلى السجل", risk: "إضافة إلى السجل" }}
        defaultAcceptLabel="اعتماد"
        emptyText="لا نتائج بانتظار المراجعة. اكتب ملاحظات التقرير ثم استخرج الإجراءات والمخاطر."
        onAccept={acceptOpsFinding}
        onReject={rejectFinding}
        onReopen={reopenFinding}
      />
    </div>
  );
}
