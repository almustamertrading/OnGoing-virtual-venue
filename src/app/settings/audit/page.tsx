import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Restricted } from "@/components/restricted";
import { getMyOrganization } from "@/lib/project";
import { DEFAULT_TIME_ZONE, formatDateTime } from "@/lib/settings";
import {
  AUDIT_PAGE_SIZE,
  auditActionLabel,
  auditActor,
  auditTarget,
  describeAuditDetails,
  eventCount,
  pageCount,
  pageRange,
  parsePage,
  type AuditParty,
} from "@/lib/settings-audit";
import type { OrganizationAuditRow } from "@/lib/types";
import { getSettingsViewer } from "../viewer";

export const metadata = { title: "سجل التدقيق | OnGoing" };

export default async function AuditPage({ searchParams }: PageProps<"/settings/audit">) {
  const { supabase, userId } = await getSettingsViewer();
  if (!userId) redirect("/login?next=/settings/audit");
  const org = await getMyOrganization();
  if (!org?.access.isAdmin) {
    return <Restricted title="هذه الصفحة لمدير المنظمة">سجل التدقيق متاح لمدير المنظمة فقط.</Restricted>;
  }

  const requested = parsePage((await searchParams).page);
  const [{ count }, { data: settings }] = await Promise.all([
    supabase.from("organization_audit").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
    supabase.from("organizations").select("timezone").eq("id", org.id).maybeSingle(),
  ]);
  const total = count ?? 0;
  const pages = pageCount(total, AUDIT_PAGE_SIZE);
  const page = Math.min(requested, pages);
  const { from, to } = pageRange(page, AUDIT_PAGE_SIZE);
  const timeZone = (settings?.timezone as string | undefined) ?? DEFAULT_TIME_ZONE;

  const { data } = total
    ? await supabase
        .from("organization_audit")
        .select("id, organization_id, actor_id, action, target_user_id, details, created_at")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)
    : { data: [] };
  const rows = (data ?? []) as OrganizationAuditRow[];

  // RLS lets members read their co-members' profiles; people who have left resolve to a label.
  const ids = [...new Set(rows.flatMap((r) => [r.actor_id, r.target_user_id]).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email").in("id", ids)
    : { data: [] as { id: string; email: string }[] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id as string, p.email as string]));

  const entries = rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    when: formatDateTime(r.created_at, timeZone),
    label: auditActionLabel(r.action),
    actor: auditActor(r.actor_id, emailById),
    target: auditTarget(r.action, r.target_user_id, r.details, emailById),
    details: describeAuditDetails(r.action, r.details),
  }));

  return (
    <>
      <h1 className="text-2xl font-semibold text-white">سجل التدقيق</h1>
      <p className="mt-1 text-sm text-slate-400">
        تغييرات الأعضاء والأدوار والصلاحيات ونطاقات البريد وإعدادات المنظمة، الأحدث أولًا. تكتبه قاعدة البيانات
        تلقائيًا ولا يمكن تعديله. الأوقات بتوقيت <bdi dir="ltr">{timeZone}</bdi>.
      </p>

      {entries.length ? (
        <div className="card mt-5 overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-right text-sm">
            <caption className="sr-only">سجل التدقيق، صفحة {page} من {pages}</caption>
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th scope="col" className="px-3 py-2 font-medium">الوقت</th>
                <th scope="col" className="px-3 py-2 font-medium">الإجراء</th>
                <th scope="col" className="px-3 py-2 font-medium">بواسطة</th>
                <th scope="col" className="px-3 py-2 font-medium">الهدف</th>
                <th scope="col" className="px-3 py-2 font-medium">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.map((e) => (
                <tr key={e.id} className="align-top text-slate-200" data-testid="audit-row">
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-400">
                    <time dateTime={e.createdAt}>{e.when}</time>
                  </td>
                  <td className="px-3 py-3">
                    <span className="whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-100">{e.label}</span>
                  </td>
                  <td className="px-3 py-3"><Party party={e.actor} /></td>
                  <td className="px-3 py-3"><Party party={e.target} /></td>
                  <td className="px-3 py-3 text-xs leading-6 text-slate-300">
                    {e.details.length ? e.details.map((line) => <p key={line}>{line}</p>) : <span className="text-slate-500">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="card mt-5 p-5 text-sm text-slate-400">لا توجد أحداث في السجل بعد.</p>
      )}

      <nav aria-label="صفحات سجل التدقيق" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-400">
          صفحة {page} من {pages} · {eventCount(total)}
        </p>
        <div className="flex gap-2">
          <PageLink page={page - 1} disabled={page <= 1}>
            <ChevronRight size={15} aria-hidden /> الصفحة السابقة
          </PageLink>
          <PageLink page={page + 1} disabled={page >= pages}>
            الصفحة التالية <ChevronLeft size={15} aria-hidden />
          </PageLink>
        </div>
      </nav>
    </>
  );
}

function Party({ party }: { party: AuditParty }) {
  return party.ltr ? <bdi dir="ltr" className="break-all">{party.text}</bdi> : <span>{party.text}</span>;
}

function PageLink({ page, disabled, children }: { page: number; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span role="link" aria-disabled="true" className="btn-ghost cursor-not-allowed opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link href={page > 1 ? `/settings/audit?page=${page}` : "/settings/audit"} className="btn-ghost">
      {children}
    </Link>
  );
}
