import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getMyOrganization } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeDelivery,
  normalizeFinance,
  normalizePipeline,
  normalizeProcurement,
  normalizeProposals,
  pipelineByStatus,
  procurementWithRfqs,
  proposalsByStatus,
  reportSummary,
  sortByName,
  sortDelivery,
} from "@/lib/reports";
import {
  DeliverySection,
  FinanceSection,
  PipelineSection,
  ProcurementSection,
  ProposalsSection,
  ReportNav,
  SummaryCards,
  type FinanceState,
} from "./sections";

export const metadata = { title: "التقارير | OnGoing" };

export default async function ReportsPage() {
  // First: createClient() marks the render as request-time (connection()) and reads the session.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login?next=/reports");
  const email = (claims.claims.email as string | undefined) ?? "";
  const org = await getMyOrganization();

  const header = (
    <AppHeader email={email}>
      <Link href="/projects" className="hover:text-white">Projects</Link>
      <span className="text-slate-600">·</span>
      <span className="text-slate-200">Reports</span>
    </AppHeader>
  );
  const title = (
    <div>
      <h1 className="text-2xl font-semibold text-white">التقارير والتحليلات</h1>
      <p className="text-sm text-slate-400">خط المشاريع والعروض والتنفيذ والمشتريات والمالية، وفق صلاحياتك.</p>
    </div>
  );

  if (!org) {
    return (
      <>
        {header}
        <main dir="rtl" lang="ar" className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6">
          {title}
          <p role="status" className="card p-4 text-sm text-slate-300">
            التقارير متاحة لأعضاء المنظمة. بريدك غير مرتبط بحساب شركة، لذا تظهر لك المشاريع التي دُعيت إليها فقط في صفحة المشاريع.
          </p>
        </main>
      </>
    );
  }

  // The five reports, in parallel. Each function runs as the signed-in user, so RLS decides
  // which projects appear, finance rows reach finance users only, and quote figures are null
  // for anyone without finance access to the project.
  const args = { org: org.id };
  const [pipeline, proposals, finance, delivery, procurement] = await Promise.all([
    supabase.rpc("report_pipeline", args),
    supabase.rpc("report_proposals", args),
    supabase.rpc("report_project_finance", args),
    supabase.rpc("report_delivery", args),
    supabase.rpc("report_procurement", args),
  ]);
  for (const [name, result] of Object.entries({ pipeline, proposals, finance, delivery, procurement })) {
    if (result.error) console.error(`report_${name} failed:`, result.error.message);
  }

  const currency = org.currency ?? "SAR";
  const financeAccess = org.access.finance;
  const pipelineRows = pipelineByStatus(normalizePipeline(pipeline.data));
  const proposalRows = proposalsByStatus(normalizeProposals(proposals.data));
  const deliveryRows = sortDelivery(normalizeDelivery(delivery.data));
  const procurementRows = procurementWithRfqs(normalizeProcurement(procurement.data, financeAccess));
  // Finance needs the capability and rows from the function; nothing finance-related is sent
  // to the browser of anyone else.
  const financeRows = financeAccess && !finance.error ? sortByName(normalizeFinance(finance.data)) : [];
  const financeState: FinanceState = !financeAccess
    ? "restricted"
    : finance.error
      ? "failed"
      : financeRows.length > 0
        ? "visible"
        : "empty";
  const summary = reportSummary({ pipeline: pipelineRows, proposals: proposalRows, delivery: deliveryRows, finance: financeRows });

  return (
    <>
      {header}
      <main dir="rtl" lang="ar" className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {title}
          <ReportNav />
        </div>

        <SummaryCards summary={summary} currency={currency} showReceivables={financeAccess} />

        <PipelineSection rows={pipelineRows} currency={currency} failed={Boolean(pipeline.error)} />
        <ProposalsSection rows={proposalRows} currency={currency} failed={Boolean(proposals.error)} />
        <DeliverySection rows={deliveryRows} failed={Boolean(delivery.error)} />
        <ProcurementSection rows={procurementRows} currency={currency} failed={Boolean(procurement.error)} />
        <FinanceSection state={financeState} rows={financeRows} currency={currency} />

        <p className="text-xs text-slate-500">
          تُحسب الأرقام من البيانات التي تملك صلاحية رؤيتها: المشاريع التي أنت عضو فيها (أو كل مشاريع المنظمة لمديرها)،
          والمالية لأصحاب صلاحية المالية فقط.
        </p>
      </main>
    </>
  );
}
