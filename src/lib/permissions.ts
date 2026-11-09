import type { OrgRole } from "@/lib/types";

/**
 * Capabilities mirror the `public.capability` enum. The database enforces them in RLS
 * (private.has_capability); the app uses the same rules only to decide what to show.
 */
export const CAPABILITIES = [
  "organization_admin",
  "project_manager",
  "finance_access",
  "sales_access",
  "operations_access",
  "viewer_access",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** Capabilities an admin can grant. organization_admin is the admin role; viewer_access is every member's baseline. */
export const GRANTABLE_CAPABILITIES = ["project_manager", "finance_access", "sales_access", "operations_access"] as const;
export type GrantableCapability = (typeof GRANTABLE_CAPABILITIES)[number];

export const CAPABILITY_LABEL: Record<Capability, { label: string; hint: string }> = {
  organization_admin: { label: "مدير المنظمة", hint: "كل الصلاحيات، وإدارة الأعضاء والإعدادات" },
  project_manager: { label: "مدير مشاريع", hint: "إنشاء المشاريع والعملاء" },
  finance_access: { label: "المالية", hint: "التكاليف والهوامش والفواتير والمصروفات وعروض الموردين وقيمة المخزون" },
  sales_access: { label: "المبيعات", hint: "العروض والعملاء والفرص (Leads)" },
  operations_access: { label: "العمليات", hint: "دليل الموردين وسجل المخزون" },
  viewer_access: { label: "مشاهدة", hint: "قراءة بيانات المنظمة دون تعديل" },
};

export type Access = {
  role: OrgRole | null;
  capabilities: ReadonlySet<Capability>;
  isAdmin: boolean;
  finance: boolean;
  sales: boolean;
  operations: boolean;
  projectManager: boolean;
  /** Projects (including leads) can be created by project managers and sales. */
  canCreateProjects: boolean;
};

const isCapability = (c: string): c is Capability => (CAPABILITIES as readonly string[]).includes(c);

/** What a member can do in their organisation: admins hold every capability; members always have viewer_access. */
export function accessFor(role: OrgRole | null | undefined, stored: readonly string[] | null | undefined): Access {
  const caps = new Set<Capability>();
  if (role === "admin") {
    CAPABILITIES.forEach((c) => caps.add(c));
  } else if (role) {
    caps.add("viewer_access");
    for (const c of stored ?? []) if (isCapability(c) && c !== "organization_admin") caps.add(c);
  }
  const has = (c: Capability) => caps.has(c);
  return {
    role: role ?? null,
    capabilities: caps,
    isAdmin: role === "admin",
    finance: has("finance_access"),
    sales: has("sales_access"),
    operations: has("operations_access"),
    projectManager: has("project_manager"),
    canCreateProjects: has("project_manager") || has("sales_access"),
  };
}

export const NO_ACCESS: Access = accessFor(null, null);

/** Postgres "insufficient privilege" (RLS) errors, turned into a message people understand. */
export function permissionMessage(error: { code?: string; message?: string } | null | undefined): string | undefined {
  if (!error) return undefined;
  if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) {
    return "ليست لديك صلاحية لهذا الإجراء. اطلب الصلاحية من مدير المنظمة.";
  }
  return error.message;
}
