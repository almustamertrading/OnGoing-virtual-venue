import "server-only";
import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiErrorMessage } from "./ai/config";
import { runAi } from "./ai/run";
import { AiError } from "./ai/types";
import type { ProjectStatus, ProjectType } from "./types";

export type RfpContact = { name: string; role: string; phone: string; email: string; address: string };
export type RfpBoqItem = { description: string; unit: string; quantity: number | null };
export type RfpPhase = { title: string; objective: string; start_date: string | null; end_date: string | null };
export type RfpRole = { title: string; responsibility: string; headcount: number };
export type RfpCriterion = { criterion: string; weight: number | null };

export type ExtractedRfp = {
  name: string;
  client_name: string;
  project_type: ProjectType;
  status: ProjectStatus;
  location: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  summary: string;
  reference: string;
  deadline: string;
  submission_method: string;
  submission_location: string;
  contact: RfpContact;
  scope: string[];
  deliverables: string[];
  boq: RfpBoqItem[];
  plan: RfpPhase[];
  team: RfpRole[];
  evaluation: RfpCriterion[];
};

const TYPES: ProjectType[] = [
  "sports_event",
  "conference",
  "exhibition",
  "festival",
  "corporate_event",
  "production",
  "other",
];

const SYSTEM = `You are a bid manager at an events and experiences company in Saudi Arabia. You read a client's RFP (Request for Proposal / كراسة شروط ومواصفات) and turn it into a structured project blueprint the delivery team can act on.

Two kinds of fields:
1) FACTS — copy only what the document states. Never invent a date, budget, number, contact, quantity or criterion. If a fact is absent, leave it empty ("", null, or []). Facts: name, client_name, contact, location, dates, budget, reference, deadline, submission, scope, deliverables, boq, evaluation.
2) PROPOSAL — you design these professionally from the scope of work, as the vendor's own proposed approach. Facts do not exist for these in the RFP, so build them yourself, grounded in the stated scope and deliverables. Proposal fields: plan (project-management phases) and team (the team structure needed to deliver).

Rules:
- The RFP is usually Arabic. Keep all text in the document's language (Arabic). Write proposed plan/team text in Arabic too.
- "client_name" is the issuing body / owner (الجهة المالكة / صاحب المنافسة), not the vendor.
- "contact" is the client's contact person/desk for this tender (اسم، جهة/منصب، هاتف، بريد، عنوان) if stated.
- "reference" = tender number (رقم الكراسة / REF). "deadline" = submission deadline text (آخر موعد لتقديم العروض), as written.
- "submission_method" = how the offer is submitted (e.g. البوابة الإلكترونية / منصة اعتماد / تسليم يدوي). "submission_location" = where/to whom (الجهة أو العنوان أو رابط المنصة).
- "boq" = bill-of-quantities line items (جدول الكميات): each item's description, unit (وحدة), and quantity if stated. Quantity is a number or null; never guess it.
- "evaluation" = the client's award/evaluation criteria (معايير التقييم / التقييم الفني والمالي): each criterion and its weight percentage if stated (number or null).
- "plan" (PROPOSAL): 3-7 project phases from mobilisation to handover, each with a short title, a one-line objective, and start/end dates ONLY if they can be grounded in the RFP timeline (else null).
- "team" (PROPOSAL): 5-12 roles needed to deliver this scope (e.g. مدير المشروع، مدير العمليات، مسؤول السلامة، فريق AVL، ...), each with a one-line responsibility and a realistic headcount.
- Dates must be ISO YYYY-MM-DD or null. Convert only clearly-Gregorian dates; Hijri or unclear → null.
- Respond with ONLY one JSON object. No prose, no code fences.`;

function prompt(types: string) {
  return `Extract and build this RFP into one JSON object with exactly these keys:
{"name": string, "client_name": string,
 "project_type": one of [${types}], "status": "lead",
 "location": string, "start_date": string|null, "end_date": string|null, "budget": number|null,
 "summary": string (2-3 sentences, document's language),
 "reference": string, "deadline": string,
 "submission_method": string, "submission_location": string,
 "contact": {"name": string, "role": string, "phone": string, "email": string, "address": string},
 "scope": string[], "deliverables": string[],
 "boq": [{"description": string, "unit": string, "quantity": number|null}],
 "evaluation": [{"criterion": string, "weight": number|null}],
 "plan": [{"title": string, "objective": string, "start_date": string|null, "end_date": string|null}],
 "team": [{"title": string, "responsibility": string, "headcount": number}]}
Remember: scope, deliverables, boq, evaluation, contact, dates and budget are FACTS from the document (empty if absent). plan and team are YOUR professional proposal built from the scope. Return only the JSON.`;
}

function coerce(raw: Record<string, unknown>): ExtractedRfp {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strArr = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 12) : [];
  const date = (v: unknown) => {
    const s = str(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  const posNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const list = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.map(obj).slice(0, 30) : [];

  const c = obj(raw.contact);
  const type = str(raw.project_type) as ProjectType;

  return {
    name: str(raw.name) || "مشروع من RFP",
    client_name: str(raw.client_name),
    project_type: TYPES.includes(type) ? type : "other",
    status: "lead",
    location: str(raw.location),
    start_date: date(raw.start_date),
    end_date: date(raw.end_date),
    budget: posNum(raw.budget),
    summary: str(raw.summary),
    reference: str(raw.reference),
    deadline: str(raw.deadline),
    submission_method: str(raw.submission_method),
    submission_location: str(raw.submission_location),
    contact: {
      name: str(c.name),
      role: str(c.role),
      phone: str(c.phone),
      email: str(c.email),
      address: str(c.address),
    },
    scope: strArr(raw.scope),
    deliverables: strArr(raw.deliverables),
    boq: list(raw.boq)
      .map((b) => ({ description: str(b.description), unit: str(b.unit), quantity: posNum(b.quantity) }))
      .filter((b) => b.description),
    evaluation: list(raw.evaluation)
      .map((e) => ({ criterion: str(e.criterion), weight: posNum(e.weight) }))
      .filter((e) => e.criterion),
    plan: list(raw.plan)
      .map((p) => ({
        title: str(p.title),
        objective: str(p.objective),
        start_date: date(p.start_date),
        end_date: date(p.end_date),
      }))
      .filter((p) => p.title),
    team: list(raw.team)
      .map((t) => ({
        title: str(t.title),
        responsibility: str(t.responsibility),
        headcount: Math.max(1, Math.round(Number(t.headcount) || 1)),
      }))
      .filter((t) => t.title),
  };
}

// Keep the request well under per-tier input limits. Tender text is front-loaded,
// so clipping the tail still captures the scope, pricing and criteria.
const MAX_TEXT_CHARS = 160_000;

/** Pulls the text layer out of a PDF, server-side, without rendering page images. */
async function extractPdfText(base64: string): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const bytes = new Uint8Array(Buffer.from(base64, "base64"));
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const joined = Array.isArray(text) ? text.join("\n") : text;
    return (joined ?? "").replace(/\u0000/g, "").trim();
  } catch {
    return "";
  }
}

/** Placeholder blueprint for the mock provider (tests, local development): clearly marked. */
function mockBlueprint(): Record<string, unknown> {
  return {
    name: "[اختبار] مشروع من كراسة تجريبية",
    client_name: "[اختبار] الجهة المالكة",
    project_type: "conference",
    status: "lead",
    location: "الرياض",
    start_date: null,
    end_date: null,
    budget: null,
    summary: "[مسودة اختبار] ملخص مولّد محليًا دون ذكاء اصطناعي.",
    reference: "TEST-RFP-001",
    deadline: "",
    submission_method: "",
    submission_location: "",
    contact: { name: "", role: "", phone: "", email: "", address: "" },
    scope: ["[اختبار] بند من نطاق العمل"],
    deliverables: [],
    boq: [{ description: "[اختبار] منصة رئيسية", unit: "مقطوعية", quantity: 1 }],
    evaluation: [],
    plan: [{ title: "التجهيز", objective: "[اختبار] مرحلة تجريبية", start_date: null, end_date: null }],
    team: [{ title: "مدير المشروع", responsibility: "[اختبار] دور تجريبي", headcount: 1 }],
  };
}

/**
 * Reads an RFP and returns the extracted project blueprint, through the cost-controlled AI
 * runner (usage log, rate limits, duplicate guard, organisation budget).
 */
export async function extractRfpFromPdf(
  supabase: SupabaseClient,
  base64: string,
  organizationId: string | null,
): Promise<ExtractedRfp> {
  // Prefer the PDF's text layer: it is a fraction of the tokens that rendering
  // every page as an image costs, which is what overruns the account's tier.
  const pdfText = await extractPdfText(base64);
  const useText = pdfText.length >= 200;
  const clipped = pdfText.length > MAX_TEXT_CHARS ? pdfText.slice(0, MAX_TEXT_CHARS) : pdfText;

  const content: Anthropic.Beta.BetaUserMessageParam["content"] = useText
    ? [
        { type: "text", text: `محتوى كراسة الشروط (RFP):\n\n${clipped}` },
        { type: "text", text: prompt(TYPES.join(", ")) },
      ]
    : [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: prompt(TYPES.join(", ")) },
      ];

  let text: string;
  try {
    const result = await runAi(
      supabase,
      {
        organizationId,
        feature: "rfp_extract",
        // The same file read twice within minutes is a repeat; its bytes identify it.
        hashParts: [createHash("sha256").update(base64).digest("hex")],
      },
      { feature: "rfp_extract", system: SYSTEM, content, maxTokens: 8000, effort: "medium", mock: mockBlueprint },
    );
    text = result.text;
  } catch (e) {
    if (e instanceof AiError && e.code === "too_large") {
      throw new AiError(
        "too_large",
        useText
          ? "حجم الكراسة كبير على باقة الحساب الحالية. جرّب تقسيم الملف أو رفع باقة Anthropic."
          : "الملف ممسوح ضوئيًا وكبير على باقة الحساب الحالية. جرّب نسخة نصية من الكراسة أو ملفًا أصغر.",
      );
    }
    throw e;
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new AiError("invalid_output", "تعذّر استخراج البيانات من الملف. جرّب ملفًا أوضح.");
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiError("invalid_output", aiErrorMessage("invalid_output"));
  }
  return coerce(parsed);
}
