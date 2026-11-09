import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { SECTION_TEMPLATES } from "./proposal-meta";
import type { ProposalType } from "./types";

export type DraftSection = { heading: string; body: string };
export type ProposalDraft = { summary: string; sections: DraftSection[] };

export class ProposalConfigError extends Error {}

const MAX_TEXT_CHARS = 120_000;

async function extractPdfText(base64: string): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(base64, "base64")));
    const { text } = await extractText(pdf, { mergePages: true });
    const joined = Array.isArray(text) ? text.join("\n") : text;
    return (joined ?? "").replace(/\u0000/g, "").trim();
  } catch {
    return "";
  }
}

/** Reads a brief that may be plain text or a base64 PDF. */
export async function briefToText(input: { text?: string; pdfBase64?: string }): Promise<string> {
  if (input.pdfBase64) {
    const t = await extractPdfText(input.pdfBase64);
    if (t.length >= 100) return t.slice(0, MAX_TEXT_CHARS);
  }
  return (input.text ?? "").slice(0, MAX_TEXT_CHARS);
}

const SYSTEM = `You are a senior bid manager at a Saudi events & experiences company. You draft a professional, client-ready proposal from a client brief. You write in clear, formal Arabic.

Hard rules (guardrails):
- Use only what the brief states or reasonable, clearly-labelled professional assumptions. Prefix any assumption with "⚠️ افتراض:".
- NEVER invent company credentials, past projects, references, certifications, supplier names, or specific prices/rates. Where a number, price, date or quantity is not given, write a placeholder like "[يُحدَّد]" instead of inventing it.
- Do not present estimates as approved quotations.
- Keep each section focused and useful (2-6 short paragraphs or a tight bullet list). No fluff.
- Output valid JSON only, no code fences, no prose outside the JSON.`;

function prompt(type: ProposalType, headings: string[], company: string, client: string) {
  return `Company (vendor): ${company}
Client: ${client || "[العميل]"}
Proposal type: ${type}

Write the proposal as a JSON object:
{"summary": string (executive summary, 2-4 sentences, Arabic),
 "sections": [{"heading": string, "body": string}]}

Produce one section for EACH of these headings, in this order, filling each with professional Arabic content grounded in the brief below:
${headings.map((h, i) => `${i + 1}. ${h}`).join("\n")}

You may use simple line breaks and "- " bullets inside a body. Return only the JSON.

===== CLIENT BRIEF =====
`;
}

/** Generates a structured proposal draft (summary + sections) from a brief. */
export async function generateProposalDraft(
  brief: string,
  type: ProposalType,
  companyName: string,
  clientName: string,
): Promise<ProposalDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ProposalConfigError("مولّد العروض بالذكاء غير مفعّل بعد: يلزم إضافة مفتاح Claude في إعدادات الموقع.");
  }
  if (brief.trim().length < 30) {
    throw new Error("الموجز قصير جدًا. ألصق موجز العميل أو ارفع ملفًا أوضح.");
  }
  const client = new Anthropic({ apiKey });
  const headings = SECTION_TEMPLATES[type];

  const response = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 8000,
    output_config: { effort: "medium" },
    system: SYSTEM,
    messages: [
      { role: "user", content: `${prompt(type, headings, companyName, clientName)}${brief}` },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("تعذّر توليد المسودة. حاول مجددًا.");

  let parsed: { summary?: unknown; sections?: unknown };
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("تعذّرت قراءة المسودة المولّدة. حاول مجددًا.");
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const sections = Array.isArray(parsed.sections)
    ? (parsed.sections as Record<string, unknown>[])
        .map((s) => ({ heading: str(s.heading), body: str(s.body) }))
        .filter((s) => s.heading || s.body)
        .slice(0, 20)
    : [];
  if (!sections.length) {
    // Fall back to the template headings with empty bodies so the user can fill them.
    return { summary: str(parsed.summary), sections: headings.map((h) => ({ heading: h, body: "" })) };
  }
  return { summary: str(parsed.summary), sections };
}
