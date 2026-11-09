import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABEL,
  AUDIT_PAGE_SIZE,
  auditActionLabel,
  auditActor,
  auditTarget,
  capabilityNames,
  describeAuditDetails,
  eventCount,
  pageCount,
  pageRange,
  parsePage,
  roleLabel,
} from "./settings-audit";

const ACTIONS = [
  "member_added", "member_removed", "role_changed", "capabilities_changed",
  "domain_added", "domain_removed", "settings_changed",
] as const;

describe("audit action labels", () => {
  it("has an Arabic label for every action the database writes", () => {
    for (const a of ACTIONS) expect(AUDIT_ACTION_LABEL[a]).toMatch(/[؀-ۿ]/);
    expect(auditActionLabel("capabilities_changed")).toBe("تغيير الصلاحيات");
    expect(auditActionLabel("domain_added")).toBe("إضافة نطاق بريد");
    expect(auditActionLabel("something_new")).toBe("something_new");
  });

  it("labels roles", () => {
    expect(roleLabel("admin")).toBe("مدير المنظمة");
    expect(roleLabel("staff")).toBe("موظف");
    expect(roleLabel(undefined)).toBe("—");
    expect(roleLabel("owner")).toBe("owner");
  });
});

describe("capability names", () => {
  it("uses CAPABILITY_LABEL names in a fixed order", () => {
    expect(capabilityNames(["finance_access", "project_manager"])).toBe("مدير مشاريع، المالية");
    expect(capabilityNames(["sales_access", "sales_access"])).toBe("المبيعات");
  });

  it("calls no capabilities viewer-only and keeps unknown values", () => {
    expect(capabilityNames([])).toBe("مشاهدة فقط");
    expect(capabilityNames(null)).toBe("مشاهدة فقط");
    expect(capabilityNames(["future_access"])).toBe("future_access");
  });
});

describe("audit details", () => {
  it("shows a role change from → to", () => {
    expect(describeAuditDetails("role_changed", { from: "staff", to: "admin" })).toEqual(["من «موظف» إلى «مدير المنظمة»"]);
  });

  it("shows a capability change from → to, with what was added and removed", () => {
    expect(describeAuditDetails("capabilities_changed", { from: ["sales_access"], to: ["finance_access", "operations_access"] })).toEqual([
      "من «المبيعات» إلى «المالية، العمليات»",
      "أُضيفت: المالية، العمليات",
      "أُزيلت: المبيعات",
    ]);
    expect(describeAuditDetails("capabilities_changed", { from: [], to: ["finance_access"] })).toEqual([
      "من «مشاهدة فقط» إلى «المالية»",
      "أُضيفت: المالية",
    ]);
  });

  it("names the settings that changed", () => {
    expect(describeAuditDetails("settings_changed", { changed: ["currency", "timezone", "default_vat_rate", "custom"] })).toEqual([
      "الحقول: العملة، المنطقة الزمنية، نسبة الضريبة الافتراضية، custom",
    ]);
  });

  it("describes added and removed members", () => {
    expect(describeAuditDetails("member_added", { role: "staff", capabilities: [] })).toEqual(["الدور: موظف", "الصلاحيات: مشاهدة فقط"]);
    expect(describeAuditDetails("member_added", { role: "admin", capabilities: [] })).toEqual(["الدور: مدير المنظمة", "الصلاحيات: كل الصلاحيات"]);
    expect(describeAuditDetails("member_removed", { role: "manager" })).toEqual(["الدور: مدير"]);
  });

  it("tolerates missing or malformed details", () => {
    expect(describeAuditDetails("settings_changed", {})).toEqual([]);
    expect(describeAuditDetails("capabilities_changed", null)).toEqual(["من «مشاهدة فقط» إلى «مشاهدة فقط»"]);
    expect(describeAuditDetails("role_changed", ["not", "an", "object"])).toEqual(["من «—» إلى «—»"]);
    expect(describeAuditDetails("domain_added", { domain: "example.com" })).toEqual([]);
    expect(describeAuditDetails("unknown", { a: 1 })).toEqual([]);
  });
});

describe("audit actor and target", () => {
  const emails = new Map([["u-admin", "admin@example.com"], ["u-pm", "pm@example.com"]]);

  it("resolves the actor's email, the system, or a former member", () => {
    expect(auditActor("u-admin", emails)).toEqual({ text: "admin@example.com", ltr: true });
    expect(auditActor(null, emails)).toEqual({ text: "النظام", ltr: false });
    expect(auditActor("u-gone", emails)).toEqual({ text: "مستخدم سابق", ltr: false });
  });

  it("shows the member, the domain, or the organisation settings as the target", () => {
    expect(auditTarget("capabilities_changed", "u-pm", {}, emails)).toEqual({ text: "pm@example.com", ltr: true });
    expect(auditTarget("member_removed", "u-gone", {}, emails)).toEqual({ text: "عضو سابق", ltr: false });
    expect(auditTarget("domain_removed", null, { domain: "old.example.com" }, emails)).toEqual({ text: "old.example.com", ltr: true });
    expect(auditTarget("domain_added", null, null, emails)).toEqual({ text: "—", ltr: false });
    expect(auditTarget("settings_changed", null, { changed: ["name"] }, emails)).toEqual({ text: "إعدادات المنظمة", ltr: false });
  });
});

describe("pagination", () => {
  it("shows 25 entries per page", () => {
    expect(AUDIT_PAGE_SIZE).toBe(25);
  });

  it("reads ?page= safely", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("2")).toBe(2);
    expect(parsePage(["3", "4"])).toBe(3);
    for (const raw of ["", "0", "-3", "abc", "2.5", "1e3", "9999999"]) expect(parsePage(raw), raw).toBe(1);
  });

  it("counts pages, with one page for an empty log", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(25)).toBe(1);
    expect(pageCount(26)).toBe(2);
    expect(pageCount(51, 25)).toBe(3);
  });

  it("maps a page to an inclusive row range", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 24 });
    expect(pageRange(3)).toEqual({ from: 50, to: 74 });
    expect(pageRange(0)).toEqual({ from: 0, to: 24 });
  });

  it("counts events with Arabic plurals", () => {
    expect(eventCount(0)).toBe("لا توجد أحداث");
    expect(eventCount(1)).toBe("حدث واحد");
    expect(eventCount(2)).toBe("حدثان");
    expect(eventCount(5)).toBe("5 أحداث");
    expect(eventCount(12)).toBe("12 حدثًا");
    expect(eventCount(100)).toBe("100 حدث");
  });
});
