"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "../../../actions";
import type { InvoiceStatus } from "@/lib/types";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => text(f, k) || null;
const num = (f: FormData, k: string) => {
  const raw = text(f, k).replace(/[, ]/g, "");
  const n = Number(raw);
  return raw && Number.isFinite(n) && n >= 0 ? n : 0;
};

// ---------------- Invoices ----------------

export async function addInvoice(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const title = text(formData, "title");
  if (!title) return { error: "اكتب وصف الفاتورة." };
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").insert({
    project_id: projectId,
    title,
    number: text(formData, "number"),
    amount: num(formData, "amount"),
    status: "draft",
    issue_date: optional(formData, "issue_date"),
    due_date: optional(formData, "due_date"),
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateInvoice(id: string, patch: { status?: InvoiceStatus; amount?: number; title?: string; number?: string; due_date?: string | null }) {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// ---------------- Expenses ----------------

export async function addExpense(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const label = text(formData, "label");
  if (!label) return { error: "اكتب وصف المصروف." };
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    project_id: projectId,
    label,
    category: text(formData, "category"),
    vendor: text(formData, "vendor"),
    amount: num(formData, "amount"),
    incurred_on: optional(formData, "incurred_on"),
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
