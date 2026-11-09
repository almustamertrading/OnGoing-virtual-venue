import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getMyOrganization } from "@/lib/project";
import {
  CURRENCIES,
  CURRENCY_LABEL,
  buildTimeZoneGroups,
  formatDateTime,
  isCurrency,
  organizationFormValues,
  safeWebsiteHref,
  supportedTimeZones,
} from "@/lib/settings";
import type { OrganizationRow } from "@/lib/types";
import { getSettingsViewer } from "../viewer";
import { OrganizationForm } from "./organization-form";

export const metadata = { title: "إعدادات المنظمة | OnGoing" };

const currencyName = (code: string) => (isCurrency(code) ? `${CURRENCY_LABEL[code]} (${code})` : code);

export default async function OrganizationSettingsPage() {
  const { supabase, userId } = await getSettingsViewer();
  if (!userId) redirect("/login?next=/settings/organization");
  const membership = await getMyOrganization();
  const { data } = membership
    ? await supabase.from("organizations").select("*").eq("id", membership.id).maybeSingle()
    : { data: null };
  const org = data as OrganizationRow | null;

  if (!membership || !org) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold text-white">إعدادات المنظمة</h1>
        <p className="card mt-6 p-5 text-sm text-slate-400" role="status">
          لست عضوًا في أي منظمة بعد. تنضم تلقائيًا عند التسجيل ببريد على نطاق منظمتك، أو يضيفك مديرها.
        </p>
      </div>
    );
  }

  const header = (
    <>
      <h1 className="text-2xl font-semibold text-white">إعدادات المنظمة</h1>
      <p className="mt-1 text-sm text-slate-400">
        {org.name} · آخر تحديث {formatDateTime(org.updated_at, org.timezone)}
      </p>
    </>
  );

  if (!membership.access.isAdmin) {
    const website = safeWebsiteHref(org.website);
    return (
      <div className="max-w-3xl">
        {header}
        <p className="mt-4 flex items-start gap-2 text-sm text-amber-200/90">
          <Lock size={15} className="mt-0.5 shrink-0" aria-hidden />
          يمكن لمدير المنظمة فقط تعديل هذه الإعدادات، وتظهر لك للعرض فقط.
        </p>
        <dl data-testid="org-readonly" className="card mt-4 grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2">
          <Item label="اسم المنظمة">{org.name}</Item>
          <Item label="العملة">{currencyName(org.currency)}</Item>
          <Item label="المنطقة الزمنية"><span dir="ltr">{org.timezone}</span></Item>
          <Item label="نسبة ضريبة القيمة المضافة الافتراضية"><span dir="ltr">{Number(org.default_vat_rate)}%</span></Item>
          <Item label="الرقم الضريبي (VAT)">{org.tax_number ? <span dir="ltr">{org.tax_number}</span> : null}</Item>
          <Item label="الهاتف">{org.phone ? <span dir="ltr">{org.phone}</span> : null}</Item>
          <Item label="الموقع الإلكتروني">
            {website ? (
              <a href={website} target="_blank" rel="noopener noreferrer" dir="ltr" className="break-all text-emerald-300 hover:underline">
                {org.website}
              </a>
            ) : (
              org.website && <span dir="ltr" className="break-all">{org.website}</span>
            )}
          </Item>
          <Item label="العنوان" wide>{org.address ? <span className="whitespace-pre-line">{org.address}</span> : null}</Item>
        </dl>
      </div>
    );
  }

  // A currency set outside the app stays visible; saving asks for one from the list.
  const currencies = [
    ...(isCurrency(org.currency) ? [] : [{ value: org.currency, label: `${org.currency} (غير مدعومة)` }]),
    ...CURRENCIES.map((c) => ({ value: c, label: currencyName(c) })),
  ];

  return (
    <div className="max-w-3xl">
      {header}
      <OrganizationForm
        initial={organizationFormValues(org)}
        currencies={currencies}
        timeZones={buildTimeZoneGroups(supportedTimeZones(), new Date(), org.timezone)}
      />
    </div>
  );
}

function Item({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="label">{label}</dt>
      <dd className="text-slate-100">{children || <span className="text-slate-500">—</span>}</dd>
    </div>
  );
}
