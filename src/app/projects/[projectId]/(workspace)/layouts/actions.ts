"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "../../../actions";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => text(f, k) || null;

export async function createLayout(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = text(formData, "name");
  if (!name) return { error: "اكتب اسم المخطط." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("layouts")
    .insert({ project_id: projectId, name, venue_id: optional(formData, "venue_id") })
    .select("id")
    .single();
  if (error) return { error: error.message };
  redirect(`/projects/${projectId}/layouts/${data.id}`);
}

export async function renameLayout(id: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("layouts").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteLayout(projectId: string, id: string) {
  const supabase = await createClient();
  const { data: layout } = await supabase.from("layouts").select("background_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("layouts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (layout?.background_path) {
    await supabase.storage.from("layouts").remove([layout.background_path]);
  }
  refresh();
}
