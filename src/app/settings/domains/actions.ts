"use server";

import { refresh } from "next/cache";
import { permissionMessage } from "@/lib/permissions";
import { getMyOrganization } from "@/lib/project";
import { domainErrorMessage, parseDomain } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export type DomainFormState = {
  /** Increases with every submission, so the input remounts with `value` below. */
  version?: number;
  error?: string;
  message?: string;
  /** What the input shows next: the submitted text when adding failed, empty after success. */
  value?: string;
};

export type DomainResult = { error?: string; message?: string };

/** Adds an email domain to the signed-in admin's organisation (RLS: admins only). */
export async function addDomain(prev: DomainFormState, formData: FormData): Promise<DomainFormState> {
  // The previous state comes from the client: read it defensively.
  const version = (typeof prev?.version === "number" ? prev.version : 0) + 1;
  const raw = String(formData.get("domain") ?? "");
  const parsed = parseDomain(raw);
  if (!parsed.ok) return { version, value: raw, error: parsed.error };

  const supabase = await createClient();
  const org = await getMyOrganization();
  if (!org?.access.isAdmin) return { version, value: raw, error: permissionMessage({ code: "42501" }) };

  const { error } = await supabase.from("organization_domains").insert({ domain: parsed.value, organization_id: org.id });
  if (error) return { version, value: raw, error: domainErrorMessage(error) };

  refresh();
  return { version, value: "", message: `أُضيف النطاق ${parsed.value}.` };
}

/** Removes one of the organisation's email domains. Existing members stay. */
export async function removeDomain(domain: string): Promise<DomainResult> {
  const parsed = parseDomain(String(domain ?? ""));
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const org = await getMyOrganization();
  if (!org?.access.isAdmin) return { error: permissionMessage({ code: "42501" }) };

  const { data, error } = await supabase
    .from("organization_domains")
    .delete()
    .eq("domain", parsed.value)
    .eq("organization_id", org.id)
    .select("domain");
  if (error) return { error: domainErrorMessage(error) };
  // RLS filters a refused delete down to zero rows instead of raising an error.
  if (!data?.length) return { error: "لم يُحذف النطاق: ربما أُزيل من قبل، أو ليست لديك صلاحية لإزالته." };

  refresh();
  return { message: `أُزيل النطاق ${parsed.value}.` };
}
