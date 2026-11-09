import { CAPABILITIES, CAPABILITY_LABEL, type Capability } from "@/lib/permissions";
import type { OrganizationAuditAction, OrgRole } from "@/lib/types";

/**
 * Turns organization_audit rows (written by database triggers) into Arabic text for the
 * Audit log page. Details are jsonb, so every reader here tolerates missing or odd values.
 */

export const AUDIT_PAGE_SIZE = 25;

export const AUDIT_ACTION_LABEL: Record<OrganizationAuditAction, string> = {
  member_added: "إضافة عضو",
  member_removed: "إزالة عضو",
  role_changed: "تغيير الدور",
  capabilities_changed: "تغيير الصلاحيات",
  domain_added: "إضافة نطاق بريد",
  domain_removed: "إزالة نطاق بريد",
  settings_changed: "تعديل إعدادات المنظمة",
};

export const ROLE_LABEL: Record<OrgRole, string> = { admin: "مدير المنظمة", manager: "مدير", staff: "موظف" };

/** Arabic names of public.organizations columns, for settings_changed entries. */
export const SETTING_LABEL: Record<string, string> = {
  name: "الاسم",
  currency: "العملة",
  timezone: "المنطقة الزمنية",
  default_vat_rate: "نسبة الضريبة الافتراضية",
  tax_number: "الرقم الضريبي",
  address: "العنوان",
  phone: "الهاتف",
  website: "الموقع الإلكتروني",
  email_domain: "نطاق البريد الأساسي",
};

const asString = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const isCapability = (value: string): value is Capability => (CAPABILITIES as readonly string[]).includes(value);

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action as OrganizationAuditAction] ?? action;
}

export function roleLabel(role: unknown): string {
  const value = asString(role);
  if (!value) return "—";
  return ROLE_LABEL[value as OrgRole] ?? value;
}

/** Capability names in a fixed order, e.g. "مدير مشاريع، المالية"; none means viewer only. */
export function capabilityNames(value: unknown): string {
  const list = [...new Set(asStrings(value))];
  if (!list.length) return "مشاهدة فقط";
  const order = (c: string) => (isCapability(c) ? CAPABILITIES.indexOf(c) : CAPABILITIES.length);
  return list
    .sort((a, b) => order(a) - order(b))
    .map((c) => (isCapability(c) ? CAPABILITY_LABEL[c].label : c))
    .join("، ");
}

/** Readable lines for the Details column. */
export function describeAuditDetails(action: string, details: unknown): string[] {
  const d = (details && typeof details === "object" && !Array.isArray(details) ? details : {}) as Record<string, unknown>;
  switch (action) {
    case "member_added":
      return [
        `الدور: ${roleLabel(d.role)}`,
        `الصلاحيات: ${d.role === "admin" ? "كل الصلاحيات" : capabilityNames(d.capabilities)}`,
      ];
    case "member_removed":
      return [`الدور: ${roleLabel(d.role)}`];
    case "role_changed":
      return [`من «${roleLabel(d.from)}» إلى «${roleLabel(d.to)}»`];
    case "capabilities_changed": {
      const from = asStrings(d.from);
      const to = asStrings(d.to);
      const lines = [`من «${capabilityNames(from)}» إلى «${capabilityNames(to)}»`];
      const added = to.filter((c) => !from.includes(c));
      const removed = from.filter((c) => !to.includes(c));
      if (added.length) lines.push(`أُضيفت: ${capabilityNames(added)}`);
      if (removed.length) lines.push(`أُزيلت: ${capabilityNames(removed)}`);
      return lines;
    }
    case "settings_changed": {
      const changed = asStrings(d.changed);
      return changed.length ? [`الحقول: ${changed.map((key) => SETTING_LABEL[key] ?? key).join("، ")}`] : [];
    }
    default:
      return [];
  }
}

export type AuditParty = { text: string; ltr: boolean };

/** Who made the change. No actor means the system (for example, joining through an email domain). */
export function auditActor(actorId: string | null, emailById: ReadonlyMap<string, string>): AuditParty {
  if (!actorId) return { text: "النظام", ltr: false };
  const email = emailById.get(actorId);
  return email ? { text: email, ltr: true } : { text: "مستخدم سابق", ltr: false };
}

/** What the change was about: a member, an email domain, or the organisation settings. */
export function auditTarget(
  action: string,
  targetUserId: string | null,
  details: unknown,
  emailById: ReadonlyMap<string, string>,
): AuditParty {
  if (action === "domain_added" || action === "domain_removed") {
    const domain = asString((details as Record<string, unknown> | null)?.domain);
    return domain ? { text: domain, ltr: true } : { text: "—", ltr: false };
  }
  if (action === "settings_changed") return { text: "إعدادات المنظمة", ltr: false };
  if (!targetUserId) return { text: "—", ltr: false };
  const email = emailById.get(targetUserId);
  return email ? { text: email, ltr: true } : { text: "عضو سابق", ltr: false };
}

/** "?page=" as a page number: 1 for anything missing or invalid. */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{1,6}$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

/** Number of pages for a total (always at least one, so an empty log has a page 1). */
export function pageCount(total: number, size: number = AUDIT_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** Inclusive row range for a page, as PostgREST's range(from, to) expects. */
export function pageRange(page: number, size: number = AUDIT_PAGE_SIZE): { from: number; to: number } {
  const from = (Math.max(1, Math.floor(page)) - 1) * size;
  return { from, to: from + size - 1 };
}

/** "حدث واحد", "حدثان", "5 أحداث", "12 حدثًا"... following Arabic plural rules. */
export function eventCount(n: number): string {
  switch (new Intl.PluralRules("ar").select(n)) {
    case "zero":
      return "لا توجد أحداث";
    case "one":
      return "حدث واحد";
    case "two":
      return "حدثان";
    case "few":
      return `${n} أحداث`;
    case "many":
      return `${n} حدثًا`;
    default:
      return `${n} حدث`;
  }
}
