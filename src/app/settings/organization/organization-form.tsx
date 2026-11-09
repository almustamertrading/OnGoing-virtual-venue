"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import type { OrganizationField, OrganizationFormValues, TimeZoneGroup } from "@/lib/settings";
import { updateOrganizationSettings, type OrganizationFormState } from "./actions";

type Option = { value: string; label: string };

const ID: Record<OrganizationField, string> = {
  name: "org-name",
  currency: "org-currency",
  timezone: "org-timezone",
  default_vat_rate: "org-vat",
  tax_number: "org-tax",
  address: "org-address",
  phone: "org-phone",
  website: "org-website",
};

const HINT: Partial<Record<OrganizationField, React.ReactNode>> = {
  timezone: "تُحسب بها التواريخ والأوقات في التقويم وسجل التدقيق.",
  default_vat_rate: "من 0 إلى 100، بمنزلتين عشريتين على الأكثر.",
  tax_number: "رقم التسجيل في ضريبة القيمة المضافة (اختياري).",
  website: (
    <>
      مثل <bdi dir="ltr">example.com</bdi>، ويُضاف <bdi dir="ltr">https://</bdi> تلقائيًا.
    </>
  ),
};

/** Admin form for the organisation's settings. The server validates everything again. */
export function OrganizationForm({
  initial,
  currencies,
  timeZones,
}: {
  initial: OrganizationFormValues;
  currencies: Option[];
  timeZones: TimeZoneGroup[];
}) {
  const [state, action, pending] = useActionState<OrganizationFormState, FormData>(updateOrganizationSettings, {});
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};

  /** Accessibility wiring shared by every control. */
  const a11y = (field: OrganizationField) => {
    const ids = [HINT[field] ? `${ID[field]}-hint` : "", errors[field] ? `${ID[field]}-error` : ""].filter(Boolean);
    return {
      id: ID[field],
      name: field,
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": ids.length ? ids.join(" ") : undefined,
    };
  };

  return (
    <form action={action} noValidate className="mt-6 space-y-5">
      {/* Remounted after each save so every control (selects included) shows the values just returned. */}
      <div key={state.version ?? 0} className="space-y-5">
        <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
          <legend className="sr-only">الهوية والضرائب</legend>
          <Field field="name" label="اسم المنظمة" error={errors.name} wide>
            <input {...a11y("name")} defaultValue={values.name} required maxLength={200} autoComplete="organization" className="field" />
          </Field>
          <Field field="currency" label="العملة" error={errors.currency}>
            <select {...a11y("currency")} defaultValue={values.currency} required className="field">
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field field="default_vat_rate" label="نسبة ضريبة القيمة المضافة الافتراضية (%)" error={errors.default_vat_rate}>
            <input
              {...a11y("default_vat_rate")}
              defaultValue={values.default_vat_rate}
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.01"
              required
              dir="ltr"
              className="field"
            />
          </Field>
          <Field field="tax_number" label="الرقم الضريبي (VAT)" error={errors.tax_number}>
            <input {...a11y("tax_number")} defaultValue={values.tax_number} maxLength={40} dir="ltr" autoComplete="off" className="field" />
          </Field>
          <Field field="timezone" label="المنطقة الزمنية" error={errors.timezone}>
            <select {...a11y("timezone")} defaultValue={values.timezone} required dir="ltr" className="field">
              {timeZones.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((z) => (
                    <option key={z.value} value={z.value}>{z.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
          <legend className="sr-only">بيانات التواصل</legend>
          <Field field="address" label="العنوان" error={errors.address} wide>
            <textarea {...a11y("address")} defaultValue={values.address} rows={3} maxLength={500} autoComplete="street-address" className="field" />
          </Field>
          <Field field="phone" label="الهاتف" error={errors.phone}>
            <input {...a11y("phone")} defaultValue={values.phone} type="tel" maxLength={40} dir="ltr" autoComplete="tel" className="field" />
          </Field>
          <Field field="website" label="الموقع الإلكتروني" error={errors.website}>
            <input
              {...a11y("website")}
              defaultValue={values.website}
              inputMode="url"
              maxLength={200}
              dir="ltr"
              autoComplete="url"
              placeholder="example.com"
              className="field"
            />
          </Field>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          <Save size={15} aria-hidden /> {pending ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
        </button>
        {state.message && !pending && <p className="text-sm text-emerald-400" role="status">{state.message}</p>}
      </div>
      {state.error && !pending && <p className="text-sm text-red-400" role="alert">{state.error}</p>}
    </form>
  );
}

function Field({
  field,
  label,
  error,
  wide,
  children,
}: {
  field: OrganizationField;
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label className="label" htmlFor={ID[field]}>{label}</label>
      {children}
      {HINT[field] && <p id={`${ID[field]}-hint`} className="mt-1 text-xs text-slate-500">{HINT[field]}</p>}
      {error && <p id={`${ID[field]}-error`} className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
