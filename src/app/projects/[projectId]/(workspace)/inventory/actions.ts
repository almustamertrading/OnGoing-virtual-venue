"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "../../../actions";
import { permissionMessage } from "@/lib/permissions";

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
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      organization_id: orgId,
      name,
      category: text(formData, "category"),
      unit: text(formData, "unit"),
      quantity: numOrNull(formData, "quantity") ?? 0,
      notes: text(formData, "notes"),
    })
    .select("id")
    .single();
  if (error) return { error: permissionMessage(error) };

  // The unit rate is inventory valuation: it lives in the finance-only table.
  const rate = numOrNull(formData, "unit_rate");
  if (rate !== null) {
    const { error: rateError } = await supabase
      .from("inventory_item_costs")
      .upsert({ item_id: data.id, organization_id: orgId, unit_rate: rate }, { onConflict: "item_id,organization_id" });
    if (rateError) return { error: permissionMessage(rateError) };
  }
  refresh();
  return { ok: true };
}

export async function updateInventoryItem(
  id: string,
  patch: { name?: string; category?: string; unit?: string; quantity?: number },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").update(patch).eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

/** Sets (or clears) an item's unit rate. Finance only; the database refuses anyone else. */
export async function setInventoryRate(itemId: string, orgId: string, rate: number | null) {
  const supabase = await createClient();
  const { error } =
    rate === null
      ? await supabase.from("inventory_item_costs").delete().eq("item_id", itemId)
      : await supabase
          .from("inventory_item_costs")
          .upsert({ item_id: itemId, organization_id: orgId, unit_rate: rate }, { onConflict: "item_id,organization_id" });
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

export async function deleteInventoryItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}
