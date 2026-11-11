import Link from "next/link";
import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { Restricted } from "@/components/restricted";
import { getMyOrganization } from "@/lib/project";
import { DEFAULT_TIME_ZONE, formatDateTime } from "@/lib/settings";
import { getSettingsViewer } from "../viewer";
import { DomainsManager, type DomainEntry } from "./domains-manager";

export const metadata = { title: "نطاقات البريد | OnGoing" };

export default async function DomainsPage() {
  const { supabase, userId } = await getSettingsViewer();
  if (!userId) redirect("/login?next=/settings/domains");
  const org = await getMyOrganization();
  if (!org?.access.isAdmin) {
    return <Restricted title="هذه الصفحة لمدير المنظمة">إدارة نطاقات البريد متاحة لمدير المنظمة فقط.</Restricted>;
  }

  const [{ data: rows }, { data: settings }] = await Promise.all([
    supabase
      .from("organization_domains")
      .select("domain, created_at")
      .eq("organization_id", org.id)
      .order("created_at")
      .order("domain"),
    supabase.from("organizations").select("email_domain, timezone").eq("id", org.id).maybeSingle(),
  ]);
  const timeZone = (settings?.timezone as string | undefined) ?? DEFAULT_TIME_ZONE;
  const domains: DomainEntry[] = (rows ?? []).map((r) => ({
    domain: r.domain as string,
    addedOn: formatDateTime(r.created_at as string, timeZone),
    primary: r.domain === settings?.email_domain,
  }));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white">نطاقات البريد الإلكتروني</h1>
      <div className="card mt-4 flex items-start gap-3 p-4 text-sm leading-7 text-slate-300">
        <Info size={18} className="mt-1 shrink-0 text-emerald-300" aria-hidden />
        <div>
          <p>
            من ينشئ حسابًا ببريد إلكتروني على أحد هذه النطاقات (مثل <bdi dir="ltr">name@example.com</bdi>) ينضم تلقائيًا
            إلى {org.name} <strong className="text-white">بصلاحية «مشاهدة» فقط</strong>.
          </p>
          <p className="mt-1 text-slate-400">
            يمنحه مدير المنظمة بعد ذلك صلاحيات إضافية من صفحة{" "}
            <Link href="/settings/members" className="text-emerald-300 underline underline-offset-2">الأعضاء</Link>. إزالة نطاق توقف
            الانضمام التلقائي الجديد ولا تُخرج الأعضاء الحاليين. أضف فقط نطاقات تملكها منظمتك.
          </p>
        </div>
      </div>
      <DomainsManager domains={domains} />
    </div>
  );
}
