"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "../../../actions";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const numOrNull = (f: FormData, k: string) => {
  const raw = text(f, k).replace(/[, ]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function addInventoryItem(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = text(formData, "name");
  if (!name) return { error: "اكتب اسم الصنف." };
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({
    organization_id: orgId,
    name,
    category: text(formData, "category"),
    unit: text(formData, "unit"),
    quantity: numOrNull(formData, "quantity") ?? 0,
    unit_rate: numOrNull(formData, "unit_rate"),
    notes: text(formData, "notes"),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateInventoryItem(
  id: string,
  patch: { name?: string; category?: string; unit?: string; quantity?: number; unit_rate?: number | null },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteInventoryItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
