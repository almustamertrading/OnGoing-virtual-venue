"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "../../../actions";
import type { QuoteRow, QuoteStatus, RfqStatus } from "@/lib/types";
import { permissionMessage } from "@/lib/permissions";

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
  if (error) return { error: permissionMessage(error) };
  refresh();
  return { ok: true };
}

export async function updateSupplier(
  id: string,
  patch: { name?: string; category?: string; contact_name?: string | null; email?: string | null; phone?: string | null; rating?: number; notes?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

export async function deleteSupplier(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw new Error(permissionMessage(error));
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
  if (error) return { error: permissionMessage(error) };
  refresh();
  return { ok: true };
}

export async function updateRfq(id: string, patch: { title?: string; category?: string; description?: string; status?: RfqStatus; due_date?: string | null }) {
  const supabase = await createClient();
  const { error } = await supabase.from("rfqs").update(patch).eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

export async function deleteRfq(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rfqs").delete().eq("id", id);
  if (error) throw new Error(permissionMessage(error));
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
  if (error) return { error: permissionMessage(error) };
  refresh();
  return { ok: true };
}

export async function updateQuote(id: string, patch: { amount?: number | null; notes?: string; status?: QuoteStatus }) {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update(patch).eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

export async function deleteQuote(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw new Error(permissionMessage(error));
  refresh();
}

export type QuoteResult = { error?: string; ok?: boolean };

function quoteMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23514") return /reason/i.test(error.message ?? "") ? "اكتب سبب الترسية." : "قيمة غير صالحة في تفاصيل العرض.";
  if (error.code === "23505") return "تمت ترسية عرض آخر في هذا الطلب. حدّث الصفحة.";
  if (error.code === "22023") return "لا يمكن ترسية عرض بلا سعر.";
  return permissionMessage(error) ?? "تعذّر تنفيذ الإجراء.";
}

/**
 * Awards a quote, with a reason, in one database transaction (award_quote): the other quotes are set
 * aside and the RFQ is marked awarded. The database records who awarded and when; nothing is automatic.
 */
export async function awardQuote(quoteId: string, reason: string): Promise<QuoteResult> {
  const why = reason.trim();
  if (!why) return { error: "اكتب سبب الترسية." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("award_quote", { qid: quoteId, reason: why.slice(0, 1000) });
  if (error) return { error: quoteMessage(error) };
  refresh();
  return { ok: true };
}

export type QuoteDetails = {
  scope_basis?: QuoteRow["scope_basis"];
  exclusions?: string;
  valid_until?: string | null;
  lead_time_days?: number | null;
  payment_terms?: string;
  amount?: number | null;
};

/** Saves the comparison details of a quote (scope basis, exclusions, validity, lead time, payment terms). */
export async function updateQuoteDetails(id: string, details: QuoteDetails): Promise<QuoteResult> {
  const patch: QuoteDetails = {};
  if (details.scope_basis !== undefined) patch.scope_basis = details.scope_basis;
  if (details.exclusions !== undefined) patch.exclusions = details.exclusions.trim().slice(0, 2000);
  if (details.payment_terms !== undefined) patch.payment_terms = details.payment_terms.trim().slice(0, 300);
  if (details.valid_until !== undefined) {
    if (details.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(details.valid_until)) return { error: "تاريخ الصلاحية غير صالح." };
    patch.valid_until = details.valid_until || null;
  }
  if (details.lead_time_days !== undefined) {
    const d = details.lead_time_days;
    if (d !== null && (!Number.isInteger(d) || d < 0 || d > 730)) return { error: "مدة التوريد بالأيام بين 0 و730." };
    patch.lead_time_days = d;
  }
  if (details.amount !== undefined) {
    if (details.amount !== null && (!Number.isFinite(details.amount) || details.amount < 0)) return { error: "السعر غير صالح." };
    patch.amount = details.amount;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").update(patch).eq("id", id).select("id");
  if (error) return { error: quoteMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true };
}
