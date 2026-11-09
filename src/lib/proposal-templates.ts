import { PROPOSAL_TYPE } from "./proposal-meta";
import type { ProposalTemplateSection, ProposalType } from "./types";

// Validation for organisation proposal templates. The database checks the same bounds
// (name 1-200, description <= 2000, at most 30 sections); this gives readable messages first.

export const TEMPLATE_LIMITS = { name: 200, description: 2000, heading: 200, guidance: 1000, sections: 30 } as const;

export type TemplateInput = {
  name: string;
  proposal_type: ProposalType;
  description: string;
  sections: ProposalTemplateSection[];
};

export type TemplateParse = { ok: true; value: TemplateInput } | { ok: false; error: string };

const isProposalType = (v: string): v is ProposalType => Object.prototype.hasOwnProperty.call(PROPOSAL_TYPE, v);

/** Reads the template form (sections arrive as JSON from the section editor). */
export function parseTemplateInput(raw: { name: unknown; proposal_type: unknown; description: unknown; sections_json: unknown }): TemplateParse {
  const name = String(raw.name ?? "").trim();
  if (!name) return { ok: false, error: "اكتب اسم القالب." };
  if (name.length > TEMPLATE_LIMITS.name) return { ok: false, error: `اسم القالب أطول من ${TEMPLATE_LIMITS.name} حرف.` };

  const type = String(raw.proposal_type ?? "");
  if (!isProposalType(type)) return { ok: false, error: "اختر نوع العرض." };

  const description = String(raw.description ?? "").trim();
  if (description.length > TEMPLATE_LIMITS.description) return { ok: false, error: `الوصف أطول من ${TEMPLATE_LIMITS.description} حرف.` };

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw.sections_json ?? "[]"));
  } catch {
    return { ok: false, error: "تعذّرت قراءة الأقسام. أعد المحاولة." };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "تعذّرت قراءة الأقسام. أعد المحاولة." };

  const sections = parsed
    .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : {}))
    .map((s) => ({ heading: String(s.heading ?? "").trim(), guidance: String(s.guidance ?? "").trim() }))
    .filter((s) => s.heading);
  if (!sections.length) return { ok: false, error: "أضف قسمًا واحدًا على الأقل." };
  if (sections.length > TEMPLATE_LIMITS.sections) return { ok: false, error: `الحد الأقصى ${TEMPLATE_LIMITS.sections} قسمًا.` };
  const tooLong = sections.find((s) => s.heading.length > TEMPLATE_LIMITS.heading || s.guidance.length > TEMPLATE_LIMITS.guidance);
  if (tooLong) return { ok: false, error: `القسم «${tooLong.heading.slice(0, 40)}» أطول من المسموح.` };
  const seen = new Set<string>();
  for (const s of sections) {
    if (seen.has(s.heading)) return { ok: false, error: `العنوان «${s.heading}» مكرر. اجعل عناوين الأقسام مختلفة.` };
    seen.add(s.heading);
  }
  return { ok: true, value: { name, proposal_type: type, description, sections } };
}

/** Reads stored sections defensively (the column is free-form JSON). */
export function templateSections(value: unknown): ProposalTemplateSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : {}))
    .map((s) => ({ heading: String(s.heading ?? "").trim(), guidance: String(s.guidance ?? "").trim() }))
    .filter((s) => s.heading)
    .slice(0, TEMPLATE_LIMITS.sections);
}
