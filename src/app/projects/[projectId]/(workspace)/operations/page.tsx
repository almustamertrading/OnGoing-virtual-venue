import Link from "next/link";
import { formatDate, todayIso } from "@/lib/format";
import { OPS_REPORT_KIND } from "@/lib/ops";
import { getProjectContext } from "@/lib/project";
import type { OpsReportRow, ProjectRiskRow } from "@/lib/types";
import { ReportForm, RiskLog } from "./operations-client";

export default async function OperationsPage({ params }: PageProps<"/projects/[projectId]/operations">) {
  const { projectId } = await params;
  const { supabase, canEdit, members, project } = await getProjectContext(projectId);
  const [{ data: reports }, { data: risks }] = await Promise.all([
    supabase.from("ops_reports").select("id, kind, title, report_date, location").eq("project_id", projectId)
      .order("report_date", { ascending: false }).order("created_at", { ascending: false }).limit(200),
    supabase.from("project_risks").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
  ]);
  const reportRows = (reports as Pick<OpsReportRow, "id" | "kind" | "title" | "report_date" | "location">[]) ?? [];

  return (
    <div dir="rtl" lang="ar" className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="card p-5" aria-labelledby="reports-title" data-testid="ops-reports">
          <h2 id="reports-title" className="mb-3 font-semibold text-white">التقارير الميدانية</h2>
          {reportRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">لا تقارير بعد. سجّل زيارة موقع أو معاينة أو محضر اجتماع.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {reportRows.map((r) => (
                <li key={r.id}>
                  <Link href={`/projects/${projectId}/operations/${r.id}`} className="flex flex-wrap items-baseline gap-2 py-2 hover:text-white">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">{OPS_REPORT_KIND[r.kind]}</span>
                    <span className="min-w-0 flex-1 text-sm text-slate-200">{r.title}</span>
                    <span className="text-xs text-slate-500"><bdi>{formatDate(r.report_date)}</bdi></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        {canEdit && <ReportForm projectId={projectId} organizationId={project.organization_id} today={todayIso()} />}
      </div>
      <RiskLog
        projectId={projectId}
        organizationId={project.organization_id}
        risks={(risks as ProjectRiskRow[]) ?? []}
        members={members}
        reports={Object.fromEntries(reportRows.map((r) => [r.id, r.title]))}
        canEdit={canEdit}
      />
    </div>
  );
}
