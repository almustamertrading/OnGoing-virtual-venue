import Link from "next/link";
import { redirect } from "next/navigation";
import { AiFindingsPanel } from "@/components/ai-findings-panel";
import { AppHeader } from "@/components/app-header";
import { Restricted } from "@/components/restricted";
import { rejectFinding, reopenFinding } from "@/lib/ai/review-actions";
import { getAiStatus } from "@/lib/ai/status";
import { formatDateTime } from "@/lib/format";
import { buildFacts, ruleSuggestions } from "@/lib/management";
import { loadManagementSummary } from "@/lib/management-brief";
import { getMyOrganization } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import type { AiFindingRow } from "@/lib/types";
import { acceptBrief } from "./actions";
import { BriefPanel } from "./brief-panel";
import {
  ApprovalsDetails, AttentionDetails, FinanceDetails, Legend, ProcurementDetails, RisksDetails, SectionCard, SuggestionsCard,
} from "./sections";

export const metadata = { title: "ملخص الإدارة | OnGoing" };

export default async function SummaryPage() {
  // First: createClient() marks the render as request-time (connection()) and reads the session.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/summary");
  const email = (claims?.claims?.email as string | undefined) ?? "";
  const org = await getMyOrganization();

  const header = (
    <AppHeader email={email}>
      <Link href="/projects" className="hover:text-white">Projects</Link>
      <span className="text-slate-600">·</span>
      <span className="text-slate-200">Summary</span>
    </AppHeader>
  );
  const shell = (body: React.ReactNode, generatedAt?: string) => (
    <>
      {header}
      <main dir="rtl" lang="ar" className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">ملخص الإدارة الأسبوعي</h1>
          <p className="text-sm text-slate-400">
            محسوب الآن من بيانات النظام وفق صلاحياتك{generatedAt && <> · <bdi>{formatDateTime(generatedAt)}</bdi></>}
          </p>
        </div>
        {body}
      </main>
    </>
  );

  if (!org) {
    return shell(
      <p role="status" className="card p-4 text-sm text-slate-300">الملخص متاح لأعضاء المنظمة. بريدك غير مرتبط بحساب شركة.</p>,
    );
  }
  const summary = await loadManagementSummary(supabase, org.id);
  if (!summary) {
    return shell(<p role="alert" className="card p-4 text-sm text-red-300">تعذّر حساب الملخص الآن. حدّث الصفحة بعد قليل.</p>);
  }

  const currency = org.currency ?? "SAR";
  const facts = buildFacts(summary, currency);
  const suggestions = ruleSuggestions(summary, currency);
  const canBrief = org.access.isAdmin || org.role === "manager" || org.access.projectManager;
  const [aiStatus, briefs] = canBrief
    ? await Promise.all([
        getAiStatus(supabase, "management_brief"),
        // Own briefs only (admins could read everyone's; this page is personal).
        supabase.from("ai_findings").select("*").eq("organization_id", org.id).eq("workflow", "management")
          .eq("created_by", userId).order("created_at", { ascending: false }).limit(60),
      ])
    : [null, null];

  return shell(
    <>
      <Legend />
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard id="attention" facts={facts}><AttentionDetails s={summary} /></SectionCard>
        <SectionCard id="approvals" facts={facts}><ApprovalsDetails s={summary} /></SectionCard>
        <SectionCard id="procurement" facts={facts}><ProcurementDetails s={summary} /></SectionCard>
        <SectionCard id="risks" facts={facts}><RisksDetails s={summary} /></SectionCard>
        <SectionCard id="pipeline" facts={facts} />
        {summary.financeAccess ? (
          <SectionCard id="finance" facts={facts}><FinanceDetails s={summary} currency={currency} /></SectionCard>
        ) : (
          <Restricted title="المؤشرات المالية" />
        )}
      </div>

      <SuggestionsCard suggestions={suggestions} />

      {canBrief && aiStatus && (
        <>
          <BriefPanel status={aiStatus} />
          <AiFindingsPanel
            title="توصيات الذكاء الاصطناعي بانتظار قرارك"
            findings={((briefs?.data as AiFindingRow[] | null) ?? [])}
            kindLabel={{ recommendation: "توصية" }}
            documents={{}}
            sourceLabel="الحقائق التي استندت إليها (وقت التوليد)"
            verifiedText="كل رقم فيها موجود في بيانات النظام"
            unverifiedText="فيها رقم أو مرجع غير موجود في الحقائق، راجعها قبل الاعتماد"
            people={{ [userId]: email }}
            canReview
            acceptLabels={{ recommendation: "اعتماد" }}
            emptyText="لا توصيات بانتظار قرارك. اطلب توصيات من بيانات هذا الأسبوع."
            onAccept={acceptBrief}
            onReject={rejectFinding}
            onReopen={reopenFinding}
          />
        </>
      )}

      <p className="text-xs text-slate-500">
        كل رقم هنا محسوب من البيانات التي تملك صلاحية رؤيتها: المشاريع التي أنت عضو فيها (أو كل المشاريع لمدير المنظمة)،
        والمالية لأصحاب صلاحية المالية فقط. التقديرات معلَّمة، ولا تُعرض أرقام لم تُحسب من النظام.
      </p>
    </>,
    summary.generatedAt,
  );
}
