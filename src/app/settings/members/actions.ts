"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GRANTABLE_CAPABILITIES, permissionMessage, type GrantableCapability } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";

const ROLES: OrgRole[] = ["admin", "manager", "staff"];

function describe(error: { code?: string; message?: string }) {
  if (error.code === "23514" && /at least one admin/i.test(error.message ?? "")) {
    return "يجب أن يبقى في المنظمة مدير واحد على الأقل.";
  }
  return permissionMessage(error);
}

/** Only organisation admins may change members (RLS refuses anyone else). */
export async function updateMemberRole(orgId: string, userId: string, role: OrgRole) {
  if (!ROLES.includes(role)) throw new Error("دور غير معروف.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw new Error(describe(error));
  if (!data?.length) throw new Error("ليست لديك صلاحية لتعديل الأعضاء.");
  refresh();
}

export async function updateMemberCapabilities(orgId: string, userId: string, capabilities: GrantableCapability[]) {
  const clean = GRANTABLE_CAPABILITIES.filter((c) => capabilities.includes(c));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ capabilities: clean })
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw new Error(describe(error));
  if (!data?.length) throw new Error("ليست لديك صلاحية لتعديل الأعضاء.");
  refresh();
}
