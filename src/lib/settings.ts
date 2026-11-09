import { permissionMessage } from "@/lib/permissions";
import type { OrganizationRow } from "@/lib/types";

/**
 * Organisation settings: pure validation shared by the settings server actions and their tests.
 * The database enforces the same limits (CHECK constraints, the time zone trigger, RLS); these
 * checks only give people a clear Arabic message before a write is attempted.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Characters, counted like Postgres char_length (code points, not UTF-16 units). */
const charLength = (value: string) => [...value].length;

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII, so people can type either. */
export function toAsciiDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

export const CURRENCIES = ["SAR", "AED", "KWD", "QAR", "BHD", "OMR", "EGP", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABEL: Record<Currency, string> = {
  SAR: "ريال سعودي",
  AED: "درهم إماراتي",
  KWD: "دينار كويتي",
  QAR: "ريال قطري",
  BHD: "دينار بحريني",
  OMR: "ريال عماني",
  EGP: "جنيه مصري",
  USD: "دولار أمريكي",
  EUR: "يورو",
  GBP: "جنيه إسترليني",
};

export const isCurrency = (value: string): value is Currency => (CURRENCIES as readonly string[]).includes(value);

// ---------------------------------------------------------------------------
// Time zone
// ---------------------------------------------------------------------------

export const DEFAULT_TIME_ZONE = "Asia/Riyadh";

let zoneList: readonly string[] | undefined;
let zoneSet: ReadonlySet<string> | undefined;

/** IANA time zones known to the runtime (Intl), plus UTC; sorted and unique. Postgres knows all of them. */
export function supportedTimeZones(): readonly string[] {
  if (!zoneList) {
    const known = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    zoneList = [...new Set([...known, DEFAULT_TIME_ZONE, "UTC"])].sort();
    zoneSet = new Set(zoneList);
  }
  return zoneList;
}

/** Exact names from the supported list only: no offsets such as "+03:00", which Postgres reads differently. */
export function isValidTimeZone(value: string): boolean {
  supportedTimeZones();
  return zoneSet!.has(value);
}

/** Zones most organisations here use, offered first. */
export const REGIONAL_TIME_ZONES = [
  "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Asia/Muscat", "Africa/Cairo",
] as const;

const AREA_LABEL: Record<string, string> = {
  Africa: "أفريقيا",
  America: "الأمريكتان",
  Antarctica: "القارة القطبية الجنوبية",
  Arctic: "القطب الشمالي",
  Asia: "آسيا",
  Atlantic: "المحيط الأطلسي",
  Australia: "أستراليا",
  Europe: "أوروبا",
  Indian: "المحيط الهندي",
  Pacific: "المحيط الهادئ",
};

export type TimeZoneOption = { value: string; label: string };
export type TimeZoneGroup = { label: string; options: TimeZoneOption[] };

/** "GMT+03:00" for a zone at a given moment (offsets change with daylight saving). */
export function timeZoneOffset(zone: string, at: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/**
 * Options for the time zone picker: the region's zones first, then every other zone grouped by
 * area. A current value missing from the list (set outside the app) is kept so it still shows.
 */
export function buildTimeZoneGroups(zones: readonly string[], at: Date, current?: string | null): TimeZoneGroup[] {
  const option = (value: string): TimeZoneOption => {
    const offset = timeZoneOffset(value, at);
    return { value, label: offset ? `${value} (${offset})` : value };
  };
  const regional: string[] = REGIONAL_TIME_ZONES.filter((z) => zones.includes(z));
  const groups: TimeZoneGroup[] = [];
  if (current && !zones.includes(current)) groups.push({ label: "القيمة الحالية", options: [option(current)] });
  groups.push({ label: "الخليج ومصر", options: regional.map(option) });
  const byArea = new Map<string, TimeZoneOption[]>();
  for (const zone of zones) {
    if (regional.includes(zone)) continue;
    const label = AREA_LABEL[zone.split("/")[0]] ?? "أخرى";
    byArea.set(label, [...(byArea.get(label) ?? []), option(zone)]);
  }
  for (const [label, options] of byArea) groups.push({ label, options });
  return groups;
}

// ---------------------------------------------------------------------------
// VAT, tax number, phone, website
// ---------------------------------------------------------------------------

/** Default VAT rate: 0 to 100 with at most two decimals (numeric(5,2) in the database). */
export function parseVatRate(raw: string): Parsed<number> {
  const text = toAsciiDigits(raw.trim()).replace(/[٫,]/g, ".");
  if (!text) return { ok: false, error: "أدخل نسبة الضريبة الافتراضية (من 0 إلى 100)." };
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) {
    return { ok: false, error: "نسبة الضريبة رقم من 0 إلى 100، بمنزلتين عشريتين على الأكثر." };
  }
  const value = Number(text);
  if (value > 100) return { ok: false, error: "نسبة الضريبة يجب أن تكون بين 0 و100." };
  return { ok: true, value };
}

/** VAT / tax registration number: Latin letters, digits, spaces and dashes; up to 40 characters. */
export function parseTaxNumber(raw: string): Parsed<string | null> {
  const text = toAsciiDigits(raw).trim().replace(/\s+/g, " ").toUpperCase();
  if (!text) return { ok: true, value: null };
  if (text.length > 40 || !/^[A-Z0-9][A-Z0-9 -]*$/.test(text)) {
    return { ok: false, error: "الرقم الضريبي: أرقام وحروف لاتينية فقط، 40 خانة على الأكثر." };
  }
  return { ok: true, value: text };
}

/** Phone: digits, spaces, an optional leading +, and ( ) . - ; 5 to 20 digits; up to 40 characters. */
export function parsePhone(raw: string): Parsed<string | null> {
  const text = toAsciiDigits(raw).trim().replace(/\s+/g, " ");
  if (!text) return { ok: true, value: null };
  const digits = text.replace(/\D/g, "").length;
  if (text.length > 40 || !/^\+?[0-9 ().-]+$/.test(text) || digits < 5 || digits > 20) {
    return { ok: false, error: "رقم الهاتف غير صالح: استخدم الأرقام والمسافات والرموز ( ) - فقط، ويمكن أن يبدأ بعلامة +." };
  }
  return { ok: true, value: text };
}

const WEB_HOST = /^([a-z0-9-]+\.)+([a-z]{2,}|xn--[a-z0-9-]+)$/;

/** Website: http(s) only, no embedded credentials; "example.com" becomes "https://example.com". */
export function parseWebsite(raw: string): Parsed<string | null> {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };
  const value = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  const invalid = { ok: false as const, error: "الموقع الإلكتروني غير صالح. اكتب عنوانًا مثل example.com أو https://example.com." };
  if (charLength(value) > 200) return { ok: false, error: "الموقع الإلكتروني 200 حرف على الأكثر." };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || !WEB_HOST.test(url.hostname)) {
    return invalid;
  }
  return { ok: true, value };
}

/** A stored website as a safe link target (http/https only), or null to show it as plain text. */
export function safeWebsiteHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The organisation settings form
// ---------------------------------------------------------------------------

export const ORGANIZATION_FIELDS = [
  "name", "currency", "timezone", "default_vat_rate", "tax_number", "address", "phone", "website",
] as const;
export type OrganizationField = (typeof ORGANIZATION_FIELDS)[number];

/** The form as submitted: every field as text. */
export type OrganizationFormValues = Record<OrganizationField, string>;

/** What the settings action writes to public.organizations. */
export type OrganizationSettingsUpdate = {
  name: string;
  currency: Currency;
  timezone: string;
  default_vat_rate: number;
  tax_number: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
};

/** Reads the form fields; anything missing or not text (a file) becomes "". */
export function readOrganizationForm(get: (field: OrganizationField) => unknown): OrganizationFormValues {
  const values = {} as OrganizationFormValues;
  for (const field of ORGANIZATION_FIELDS) {
    const value = get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/** The form's starting values for a stored organisation or a validated update. */
export function organizationFormValues(org: Pick<OrganizationRow, OrganizationField> | OrganizationSettingsUpdate): OrganizationFormValues {
  return {
    name: org.name,
    currency: org.currency,
    timezone: org.timezone,
    default_vat_rate: String(Number(org.default_vat_rate)),
    tax_number: org.tax_number ?? "",
    address: org.address ?? "",
    phone: org.phone ?? "",
    website: org.website ?? "",
  };
}

export function validateOrganizationSettings(
  input: OrganizationFormValues,
): { ok: true; value: OrganizationSettingsUpdate } | { ok: false; errors: Partial<Record<OrganizationField, string>> } {
  const errors: Partial<Record<OrganizationField, string>> = {};

  const name = input.name.trim();
  if (!name) errors.name = "اسم المنظمة مطلوب.";
  else if (charLength(name) > 200) errors.name = "اسم المنظمة 200 حرف على الأكثر.";

  const currency = input.currency.trim().toUpperCase();
  if (!isCurrency(currency)) errors.currency = "اختر عملة من القائمة.";

  const timezone = input.timezone.trim();
  if (!isValidTimeZone(timezone)) errors.timezone = "اختر منطقة زمنية من القائمة.";

  const vat = parseVatRate(input.default_vat_rate);
  if (!vat.ok) errors.default_vat_rate = vat.error;

  const tax = parseTaxNumber(input.tax_number);
  if (!tax.ok) errors.tax_number = tax.error;

  const address = input.address.trim();
  if (charLength(address) > 500) errors.address = "العنوان 500 حرف على الأكثر.";

  const phone = parsePhone(input.phone);
  if (!phone.ok) errors.phone = phone.error;

  const website = parseWebsite(input.website);
  if (!website.ok) errors.website = website.error;

  if (Object.keys(errors).length || !vat.ok || !tax.ok || !phone.ok || !website.ok) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      currency: currency as Currency,
      timezone,
      default_vat_rate: vat.value,
      tax_number: tax.value,
      address: address || null,
      phone: phone.value,
      website: website.value,
    },
  };
}

type DbError = { code?: string; message?: string } | null | undefined;

/** A refused or failed organisation update, in words people understand. */
export function organizationErrorMessage(error: DbError): string | undefined {
  if (!error) return undefined;
  // Raised by the organizations trigger for a time zone Postgres does not know.
  if (error.code === "22023") return "المنطقة الزمنية غير معروفة لقاعدة البيانات. اختر منطقة زمنية أخرى من القائمة.";
  if (error.code === "23514" || error.code === "22003" || error.code === "22P02") {
    return "إحدى القيم غير مقبولة. تحقّق من نسبة الضريبة وأطوال النصوص.";
  }
  return permissionMessage(error);
}

// ---------------------------------------------------------------------------
// Email domains
// ---------------------------------------------------------------------------

/** The database CHECK on organization_domains.domain. */
export const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export const DOMAIN_FORMAT_ERROR = "صيغة النطاق غير صحيحة. اكتب النطاق فقط، مثل example.com.";

/** Lower-case, trimmed; accepts a pasted e-mail address or URL and keeps only the domain. */
export function normalizeDomain(raw: string): string {
  let value = raw.trim().toLowerCase();
  if (/^https?:\/\//.test(value)) {
    try {
      value = new URL(value).hostname;
    } catch {
      // Not a URL after all: validation explains.
    }
  }
  const at = value.lastIndexOf("@");
  if (at >= 0) value = value.slice(at + 1);
  return value.replace(/\.$/, "");
}

/** The database pattern, plus DNS label rules (1-63 characters, no leading or trailing dash, 253 total). */
export function isValidDomain(value: string): boolean {
  if (value.length > 253 || !DOMAIN_PATTERN.test(value)) return false;
  return value.split(".").every((label) => label.length <= 63 && !label.startsWith("-") && !label.endsWith("-"));
}

export function parseDomain(raw: string): Parsed<string> {
  const value = normalizeDomain(raw);
  if (!value) return { ok: false, error: "أدخل نطاق البريد، مثل example.com." };
  if (!isValidDomain(value)) return { ok: false, error: DOMAIN_FORMAT_ERROR };
  return { ok: true, value };
}

/** A refused or failed domain change, in words people understand. */
export function domainErrorMessage(error: DbError): string | undefined {
  if (!error) return undefined;
  // organization_domains.domain is unique across all organisations.
  if (error.code === "23505") return "هذا النطاق مسجَّل مسبقًا ولا يمكن إضافته مرة أخرى.";
  if (error.code === "23514") return DOMAIN_FORMAT_ERROR;
  return permissionMessage(error);
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const DATE_TIME_LOCALE = "ar-u-ca-gregory-nu-latn";

/** A timestamp in the organisation's time zone (Gregorian calendar, Latin digits). */
export function formatDateTime(iso: string, timeZone: string = DEFAULT_TIME_ZONE): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const options = { dateStyle: "medium", timeStyle: "short" } as const;
  try {
    return new Intl.DateTimeFormat(DATE_TIME_LOCALE, { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(DATE_TIME_LOCALE, { ...options, timeZone: DEFAULT_TIME_ZONE }).format(date);
  }
}
