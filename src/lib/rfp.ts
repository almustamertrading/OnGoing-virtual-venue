import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ProjectStatus, ProjectType } from "./types";

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
  scope: string[];
  deliverables: string[];
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

const SYSTEM = `You read a client's RFP (Request for Proposal / كراسة شروط ومواصفات) for an events and experiences company in Saudi Arabia, and extract the key facts so a project record can be created.
Rules:
- The RFP may be in Arabic or English. Keep extracted text in its original language (usually Arabic).
- Only use facts stated in the document. Never invent dates, budgets, or numbers. If a field is not stated, leave it empty ("" or null).
- "client_name" is the issuing body / owner (الجهة المالكة / صاحب المنافسة), not the vendor.
- "reference" is the RFP/tender number if any (رقم الكراسة / REF).
- "deadline" is the submission deadline text if any (آخر موعد للتقديم), as written.
- "scope" is the scope of work items; "deliverables" is what the vendor must deliver. 3-8 short items each, in the document's language.
- Dates must be ISO YYYY-MM-DD or null. Convert only clearly-Gregorian dates; if a date is Hijri or unclear, use null.
- Respond with ONLY one JSON object, no prose, no code fences.`;

function prompt(statuses: string, types: string) {
  return `Extract this RFP into a JSON object with exactly these keys:
{"name": string (the project/competition title),
 "client_name": string,
 "project_type": one of [${types}],
 "status": "lead",
 "location": string,
 "start_date": string|null, "end_date": string|null,
 "budget": number|null,
 "summary": string (2-3 sentences, in the document's language),
 "reference": string, "deadline": string,
 "scope": string[], "deliverables": string[]}
Choose project_type as the closest fit. Status is always "lead". Return only the JSON.
Statuses available (for reference): ${statuses}.`;
}

function coerce(raw: Record<string, unknown>): ExtractedRfp {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 10) : [];
  const date = (v: unknown) => {
    const s = str(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  const type = str(raw.project_type) as ProjectType;
  const num = Number(raw.budget);
  return {
    name: str(raw.name) || "مشروع من RFP",
    client_name: str(raw.client_name),
    project_type: TYPES.includes(type) ? type : "other",
    status: "lead",
    location: str(raw.location),
    start_date: date(raw.start_date),
    end_date: date(raw.end_date),
    budget: Number.isFinite(num) && num > 0 ? num : null,
    summary: str(raw.summary),
    reference: str(raw.reference),
    deadline: str(raw.deadline),
    scope: arr(raw.scope),
    deliverables: arr(raw.deliverables),
  };
}

export class RfpConfigError extends Error {}

/** Sends the PDF to Claude and returns the extracted project fields. */
export async function extractRfpFromPdf(base64: string): Promise<ExtractedRfp> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new RfpConfigError("ميزة قراءة الـRFP غير مفعّلة بعد: يلزم إضافة مفتاح Claude في إعدادات الموقع.");
  }
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 4096,
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: prompt("lead, proposal, confirmed, in_progress, completed, on_hold, cancelled", TYPES.join(", ")) },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("تعذّر استخراج البيانات من الملف. جرّب ملفًا أوضح.");
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("تعذّر قراءة البيانات المستخرجة. حاول مرة أخرى.");
  }
  return coerce(parsed);
}
