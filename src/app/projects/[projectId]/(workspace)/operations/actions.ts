"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { aiErrorMessage } from "@/lib/ai/config";
import { acceptFindingVia, type ReviewResult } from "@/lib/ai/review-actions";
import { AiError, type AiErrorCode } from "@/lib/ai/types";
import { OPS_REPORT_KIND, type OpsReportKind } from "@/lib/ops";
import { extractOpsFindings } from "@/lib/ops-extract";
import { permissionMessage } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type OpsState = { error?: string; ok?: boolean; message?: string; code?: AiErrorCode; nonce?: number };

const KINDS = Object.keys(OPS_REPORT_KIND) as OpsReportKind[];
const text = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function fields(f: FormData) {
  const kind = text(f, "kind", 40) as OpsReportKind;
  return {
    kind: KINDS.includes(kind) ? kind : "daily_report",
    title: text(f, "title", 300),
    report_date: date(text(f, "report_date", 10)),
    location: text(f, "location", 300),
    attendees: text(f, "attendees", 1000),
    body: text(f, "body", 20000),
  };
}

export async function createReport(projectId: string, organizationId: string, _prev: OpsState, formData: FormData): Promise<OpsState> {
  const v = fields(formData);
  if (!v.title) return { error: "اكتب عنوان التقرير." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ops_reports")
    .insert({ ...v, report_date: v.report_date ?? undefined, project_id: projectId, organization_id: organizationId })
    .select("id")
    .single();
  if (error || !data) return { error: permissionMessage(error) ?? "تعذّر حفظ التقرير." };
  redirect(`/projects/${projectId}/operations/${data.id}`);
}

export async function updateReport(reportId: string, _prev: OpsState, formData: FormData): Promise<OpsState> {
  const v = fields(formData);
  if (!v.title) return { error: "اكتب عنوان التقرير." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ops_reports").update({ ...v, report_date: v.report_date ?? undefined }).eq("id", reportId).select("id");
  if (error) return { error: permissionMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true, message: "حُفظ التقرير.", nonce: Date.now() };
}

export async function deleteReport(projectId: string, reportId: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ops_reports").delete().eq("id", reportId).select("id");
  if (error) return { error: permissionMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  redirect(`/projects/${projectId}/operations`);
}

/** Runs the AI extraction on a report. Results arrive as findings to review. */
export async function extractReport(projectId: string, reportId: string, _prev: OpsState, formData: FormData): Promise<OpsState> {
  const supabase = await createClient();
  const { data: memberRows } = await supabase.from("project_members").select("user_id").eq("project_id", projectId);
  const ids = (memberRows ?? []).map((m) => m.user_id as string);
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const members = ((profiles as { id: string; email: string }[]) ?? []).map((p) => ({ user_id: p.id, email: p.email }));
  try {
    const r = await extractOpsFindings(supabase, { projectId, reportId, members, force: formData.get("force") === "on" });
    refresh();
    if (r.created === 0) return { ok: true, message: "لم يُعثر على إجراءات أو مخاطر في نص التقرير." };
    return { ok: true, message: `أُضيفت ${r.created} نتيجة للمراجعة، منها ${r.verified} بنص مُتحقَّق منه في التقرير.` };
  } catch (e) {
    if (e instanceof AiError) return { error: e.message, code: e.code };
    console.error("extractReport failed:", e);
    return { error: aiErrorMessage("failed"), code: "failed" };
  }
}

/** Action items become tasks, issues and risks join the log (each in one transaction); decisions are acknowledged. */
export async function acceptOpsFinding(findingId: string, kind: string, note: string): Promise<ReviewResult> {
  const rpc = kind === "action_item" ? "accept_finding_as_task" : kind === "issue" || kind === "risk" ? "accept_finding_as_risk" : null;
  return acceptFindingVia(rpc, findingId, note);
}

// ---------------- Issues and risks log ----------------

export async function addRisk(projectId: string, organizationId: string, _prev: OpsState, formData: FormData): Promise<OpsState> {
  const title = text(formData, "title", 300);
  if (!title) return { error: "اكتب المشكلة أو الخطر." };
  const kind = text(formData, "kind", 10) === "risk" ? "risk" : "issue";
  const impact = ["low", "medium", "high"].includes(text(formData, "impact", 10)) ? text(formData, "impact", 10) : "medium";
  const supabase = await createClient();
  const { error } = await supabase.from("project_risks").insert({
    project_id: projectId, organization_id: organizationId, kind, title, impact,
    likelihood: kind === "risk" ? impact : null,
    mitigation: text(formData, "mitigation", 2000),
  });
  if (error) return { error: permissionMessage(error) };
  refresh();
  return { ok: true, nonce: Date.now() };
}

export type RiskPatch = { status?: "open" | "mitigating" | "closed"; owner_id?: string | null; impact?: "low" | "medium" | "high"; due_date?: string | null };

export async function updateRisk(id: string, patch: RiskPatch): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_risks").update(patch).eq("id", id).select("id");
  if (error) return { error: error.code === "23514" ? "المسؤول يجب أن يكون عضوًا في المشروع أو المنظمة." : permissionMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true };
}

export async function deleteRisk(id: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_risks").delete().eq("id", id).select("id");
  if (error) return { error: permissionMessage(error) };
  if (!data?.length) return { error: permissionMessage({ code: "42501" }) };
  refresh();
  return { ok: true };
}
