"use server";

import { refresh } from "next/cache";
import { permissionMessage } from "@/lib/permissions";
import { getMyOrganization } from "@/lib/project";
import {
  organizationErrorMessage,
  organizationFormValues,
  readOrganizationForm,
  validateOrganizationSettings,
  type OrganizationField,
  type OrganizationFormValues,
} from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export type OrganizationFormState = {
  /** Increases with every submission, so the form remounts with the values below. */
  version?: number;
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<OrganizationField, string>>;
  /** What the fields show next: the saved values, or what was submitted when saving failed. */
  values?: OrganizationFormValues;
};

/**
 * Updates the signed-in admin's own organisation. The organisation comes from the session, never
 * from the form; RLS allows the update for organisation admins only.
 */
export async function updateOrganizationSettings(
  prev: OrganizationFormState,
  formData: FormData,
): Promise<OrganizationFormState> {
  // The previous state comes from the client: read it defensively.
  const version = (typeof prev?.version === "number" ? prev.version : 0) + 1;
  const values = readOrganizationForm((field) => formData.get(field));
  const refused = permissionMessage({ code: "42501" });

  const supabase = await createClient();
  const org = await getMyOrganization();
  if (!org) return { version, values, error: "لست عضوًا في أي منظمة." };
  if (!org.access.isAdmin) return { version, values, error: refused };

  const parsed = validateOrganizationSettings(values);
  if (!parsed.ok) {
    return { version, values, fieldErrors: parsed.errors, error: "لم تُحفظ الإعدادات: صحّح الحقول المُعلَّمة." };
  }

  const { data, error } = await supabase.from("organizations").update(parsed.value).eq("id", org.id).select("id");
  if (error) return { version, values, error: organizationErrorMessage(error) };
  // RLS filters a refused update down to zero rows instead of raising an error.
  if (!data?.length) return { version, values, error: refused };

  refresh();
  return { version, values: organizationFormValues(parsed.value), message: "تم حفظ إعدادات المنظمة." };
}
