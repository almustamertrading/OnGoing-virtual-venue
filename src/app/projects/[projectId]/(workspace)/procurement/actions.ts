"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "../../../actions";
import type { QuoteStatus, RfqStatus } from "@/lib/types";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => text(f, k) || null;
const num = (f: FormData, k: string) => {
  const raw = text(f, k).replace(/[, ]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// ---------------- Suppliers (organisation directory) ----------------

export async function addSupplier(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = text(formData, "name");
  if (!name) return { error: "اكتب اسم المورّد." };
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({
    organization_id: orgId,
    name,
    category: text(formData, "category"),
    contact_name: optional(formData, "contact_name"),
    email: optional(formData, "email"),
    phone: optional(formData, "phone"),
    rating: Math.max(0, Math.min(5, Math.round(num(formData, "rating") ?? 0))),
    notes: text(formData, "notes"),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateSupplier(
  id: string,
  patch: { name?: string; category?: string; contact_name?: string | null; email?: string | null; phone?: string | null; rating?: number; notes?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteSupplier(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// ---------------- RFQs ----------------

export async function addRfq(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const title = text(formData, "title");
  if (!title) return { error: "اكتب عنوان الطلب." };
  const supabase = await createClient();
  const { error } = await supabase.from("rfqs").insert({
    project_id: projectId,
    title,
    category: text(formData, "category"),
    description: text(formData, "description"),
    due_date: optional(formData, "due_date"),
    status: "draft",
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateRfq(id: string, patch: { title?: string; category?: string; description?: string; status?: RfqStatus; due_date?: string | null }) {
  const supabase = await createClient();
  const { error } = await supabase.from("rfqs").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteRfq(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rfqs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// ---------------- Quotes ----------------

export async function addQuote(
  projectId: string,
  rfqId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supplierId = optional(formData, "supplier_id");
  const supplierName = text(formData, "supplier_name");
  if (!supplierId && !supplierName) return { error: "اختر مورّدًا أو اكتب اسمه." };
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").insert({
    rfq_id: rfqId,
    project_id: projectId,
    supplier_id: supplierId,
    supplier_name: supplierName,
    amount: num(formData, "amount"),
    notes: text(formData, "notes"),
    status: "received",
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateQuote(id: string, patch: { amount?: number | null; notes?: string; status?: QuoteStatus }) {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteQuote(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

/** Accept one quote: reject the rest in its RFQ and mark the RFQ awarded. */
export async function acceptQuote(rfqId: string, quoteId: string) {
  const supabase = await createClient();
  const { error: rej } = await supabase.from("quotes").update({ status: "rejected" }).eq("rfq_id", rfqId).neq("id", quoteId);
  if (rej) throw new Error(rej.message);
  const { error: acc } = await supabase.from("quotes").update({ status: "accepted" }).eq("id", quoteId);
  if (acc) throw new Error(acc.message);
  const { error: aw } = await supabase.from("rfqs").update({ status: "awarded" }).eq("id", rfqId);
  if (aw) throw new Error(aw.message);
  refresh();
}
