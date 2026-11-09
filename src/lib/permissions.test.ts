import { describe, expect, it } from "vitest";
import { CAPABILITIES, accessFor, permissionMessage } from "./permissions";

describe("accessFor", () => {
  it("gives admins every capability", () => {
    const a = accessFor("admin", []);
    expect([...a.capabilities].sort()).toEqual([...CAPABILITIES].sort());
    expect(a.isAdmin && a.finance && a.sales && a.operations && a.projectManager).toBe(true);
    expect(a.canCreateProjects).toBe(true);
  });

  it("gives staff only viewer access by default (least privilege)", () => {
    const a = accessFor("staff", []);
    expect([...a.capabilities]).toEqual(["viewer_access"]);
    expect(a.finance || a.sales || a.operations || a.canCreateProjects).toBe(false);
  });

  it("adds granted capabilities", () => {
    const a = accessFor("staff", ["finance_access"]);
    expect(a.finance).toBe(true);
    expect(a.sales).toBe(false);
    expect(a.canCreateProjects).toBe(false);
  });

  it("lets sales and project managers create projects", () => {
    expect(accessFor("staff", ["sales_access"]).canCreateProjects).toBe(true);
    expect(accessFor("manager", ["project_manager"]).canCreateProjects).toBe(true);
  });

  it("ignores organization_admin when stored, and unknown values", () => {
    const a = accessFor("staff", ["organization_admin", "root", "finance_access"]);
    expect(a.isAdmin).toBe(false);
    expect(a.capabilities.has("organization_admin")).toBe(false);
    expect(a.finance).toBe(true);
    expect(a.capabilities.size).toBe(2);
  });

  it("gives non-members nothing", () => {
    expect(accessFor(null, ["finance_access"]).capabilities.size).toBe(0);
    expect(accessFor(undefined, undefined).finance).toBe(false);
  });
});

describe("permissionMessage", () => {
  it("explains RLS refusals", () => {
    expect(permissionMessage({ code: "42501", message: "x" })).toMatch(/صلاحية/);
    expect(permissionMessage({ message: 'new row violates row-level security policy for table "invoices"' })).toMatch(/صلاحية/);
  });
  it("passes other errors through", () => {
    expect(permissionMessage({ code: "23505", message: "duplicate key" })).toBe("duplicate key");
  });
  it("returns undefined without an error", () => {
    expect(permissionMessage(null)).toBeUndefined();
  });
});
