import Link from "next/link";
import { redirect } from "next/navigation";
import { AiFindingsPanel } from "@/components/ai-findings-panel";
import { AppHeader } from "@/components/app-header";
import { Restricted } from "@/components/restricted";
import { rejectFinding, reopenFinding } from "@/lib/ai/review-actions";
import { getAiStatus } from "@/lib/ai/status";
import { formatDate, formatDateTime } from "@/lib/format";
import { buildFacts, factDeltas, ruleSuggestions, weekStart } from "@/lib/management";
import { loadManagementSummary } from "@/lib/management-brief";
import { getMyOrganization } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import type { AiFindingRow } from "@/lib/types";
import { acceptBrief } from "./actions";
import { BriefPanel } from "./brief-panel";
import { SnapshotRecorder } from "./snapshot-recorder";
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
  // This user's two latest weekly snapshots: is this week's taken yet, and what was last week's?
  const thisWeek = weekStart(summary.today);
  const { data: snaps } = await supabase
    .from("management_snapshots").select("week_start, facts, created_at")
    .eq("organization_id", org.id).eq("user_id", userId).order("week_start", { ascending: false }).limit(2);
  const snapshots = (snaps as { week_start: string; facts: unknown; created_at: string }[] | null) ?? [];
  const previous = snapshots.find((x) => x.week_start < thisWeek) ?? null;
  const deltas = previous ? factDeltas(facts, previous.facts) : {};
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
      <SnapshotRecorder needed={!snapshots.some((x) => x.week_start === thisWeek)} />
      <Legend />
      <p className="text-xs text-slate-400" data-testid="snapshot-note">
        {previous ? (
          <>التغير بجانب كل رقم مقارنةً بلقطة أسبوع <bdi>{formatDate(previous.week_start)}</bdi> (حُفظت <bdi>{formatDateTime(previous.created_at)}</bdi>).</>
        ) : (
          "تُحفظ لقطة من أرقامك (دون المالية) مرة كل أسبوع، وستظهر هنا التغيرات عن الأسبوع الماضي."
        )}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard id="attention" facts={facts} deltas={deltas}><AttentionDetails s={summary} /></SectionCard>
        <SectionCard id="approvals" facts={facts} deltas={deltas}><ApprovalsDetails s={summary} /></SectionCard>
        <SectionCard id="procurement" facts={facts} deltas={deltas}><ProcurementDetails s={summary} /></SectionCard>
        <SectionCard id="risks" facts={facts} deltas={deltas}><RisksDetails s={summary} /></SectionCard>
        <SectionCard id="pipeline" facts={facts} deltas={deltas} />
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
