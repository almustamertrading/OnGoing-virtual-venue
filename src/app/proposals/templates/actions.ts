"use server";

import { refresh } from "next/cache";
import { permissionMessage } from "@/lib/permissions";
import { getMyOrganization } from "@/lib/project";
import { parseTemplateInput } from "@/lib/proposal-templates";
import { createClient } from "@/lib/supabase/server";

export type TemplateState = { error?: string; message?: string; ok?: boolean; version?: number };

/** Creates or updates a template in the signed-in user's organisation (RLS: sales access). */
export async function saveTemplate(templateId: string | null, prev: TemplateState, formData: FormData): Promise<TemplateState> {
  const version = (typeof prev?.version === "number" ? prev.version : 0) + 1;
  const parsed = parseTemplateInput({
    name: formData.get("name"),
    proposal_type: formData.get("proposal_type"),
    description: formData.get("description"),
    sections_json: formData.get("sections_json"),
  });
  if (!parsed.ok) return { version, error: parsed.error };

  const org = await getMyOrganization();
  if (!org?.access.sales) return { version, error: permissionMessage({ code: "42501" }) };
  const supabase = await createClient();
  const { data, error } = templateId
    ? await supabase.from("proposal_templates").update(parsed.value).eq("id", templateId).eq("organization_id", org.id).select("id")
    : await supabase.from("proposal_templates").insert({ ...parsed.value, organization_id: org.id }).select("id");
  if (error) return { version, error: error.code === "23505" ? "يوجد قالب بهذا الاسم. اختر اسمًا آخر." : permissionMessage(error) };
  // RLS turns a refused update into "no rows" rather than an error.
  if (!data?.length) return { version, error: permissionMessage({ code: "42501" }) };
  refresh();
  return { version, ok: true, message: templateId ? "حُفظ القالب." : "أُنشئ القالب." };
}

/** Deletes a template. Proposals made from it keep their content; their link is cleared. */
export async function deleteTemplate(templateId: string): Promise<TemplateState> {
  const org = await getMyOrganization();
  if (!org?.access.sales) return { error: permissionMessage({ code: "42501" }) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposal_templates").delete().eq("id", templateId).eq("organization_id", org.id).select("id");
  if (error) return { error: permissionMessage(error) };
  if (!data?.length) return { error: "لم يُحذف القالب: ربما حُذف من قبل، أو ليست لديك صلاحية." };
  refresh();
  return { ok: true, message: "حُذف القالب." };
}
