"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskPriority, TaskStatus } from "@/lib/types";
import type { ActionState } from "../../actions";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => text(f, k) || null;
const num = (f: FormData, k: string) => {
  const raw = text(f, k).replace(/[, ]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// ---------------- Scope and deliverables ----------------

export async function addScopeItem(
  projectId: string,
  kind: "scope" | "deliverable",
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const title = text(formData, "title");
  if (!title) return { error: "Write a title first." };
  const supabase = await createClient();
  const { error } = await supabase.from("scope_items").insert({
    project_id: projectId,
    kind,
    title,
    description: text(formData, "description"),
    due_date: optional(formData, "due_date"),
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateScopeItem(
  id: string,
  patch: { title?: string; description?: string; status?: "planned" | "in_progress" | "done"; due_date?: string | null },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("scope_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteScopeItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("scope_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// ---------------- Milestones ----------------

export async function addMilestone(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const title = text(formData, "title");
  if (!title) return { error: "Name the milestone." };
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").insert({
    project_id: projectId,
    title,
    due_date: optional(formData, "due_date"),
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateMilestone(id: string, patch: { done?: boolean; title?: string; due_date?: string | null }) {
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteMilestone(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// ---------------- Tasks ----------------

export async function addTask(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const title = text(formData, "title");
  if (!title) return { error: "Write the task first." };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    project_id: projectId,
    title,
    description: text(formData, "description"),
    assignee_id: optional(formData, "assignee_id"),
    due_date: optional(formData, "due_date"),
    priority: (optional(formData, "priority") ?? "normal") as TaskPriority,
    milestone_id: optional(formData, "milestone_id"),
    scope_item_id: optional(formData, "scope_item_id"),
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export type TaskPatch = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  milestone_id?: string | null;
};

export async function updateTask(id: string, patch: TaskPatch) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("You can't change this task.");
  refresh();
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// ---------------- BOQ / pricing ----------------

export async function addBoqItem(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const description = text(formData, "description");
  if (!description) return { error: "اكتب وصف البند." };
  const supabase = await createClient();
  const { error } = await supabase.from("boq_items").insert({
    project_id: projectId,
    description,
    unit: text(formData, "unit"),
    quantity: num(formData, "quantity"),
    unit_price: num(formData, "unit_price"),
    notes: text(formData, "notes"),
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateBoqItem(
  id: string,
  patch: { description?: string; unit?: string; quantity?: number | null; unit_price?: number | null; notes?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("boq_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteBoqItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("boq_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// ---------------- Plan phases ----------------

export async function addPlanPhase(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const title = text(formData, "title");
  if (!title) return { error: "اكتب اسم المرحلة." };
  const supabase = await createClient();
  const { error } = await supabase.from("plan_phases").insert({
    project_id: projectId,
    title,
    objective: text(formData, "objective"),
    start_date: optional(formData, "start_date"),
    end_date: optional(formData, "end_date"),
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updatePlanPhase(
  id: string,
  patch: { title?: string; objective?: string; start_date?: string | null; end_date?: string | null },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_phases").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deletePlanPhase(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_phases").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// ---------------- Team roles ----------------

export async function addTeamRole(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const title = text(formData, "title");
  if (!title) return { error: "اكتب اسم الدور." };
  const supabase = await createClient();
  const { error } = await supabase.from("team_roles").insert({
    project_id: projectId,
    title,
    responsibility: text(formData, "responsibility"),
    headcount: Math.max(0, Math.round(num(formData, "headcount") ?? 1)),
    reports_to: text(formData, "reports_to"),
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateTeamRole(
  id: string,
  patch: { title?: string; responsibility?: string; headcount?: number; reports_to?: string; assignee_id?: string | null },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("team_roles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteTeamRole(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("team_roles").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// ---------------- Evaluation criteria (KPIs) ----------------

export async function addCriterion(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const criterion = text(formData, "criterion");
  if (!criterion) return { error: "اكتب معيار التقييم." };
  const supabase = await createClient();
  const { error } = await supabase.from("evaluation_criteria").insert({
    project_id: projectId,
    criterion,
    weight: num(formData, "weight"),
    sort_order: Date.now(),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateCriterion(
  id: string,
  patch: { criterion?: string; weight?: number | null; met?: boolean; evidence?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("evaluation_criteria").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteCriterion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("evaluation_criteria").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
