import { describe, expect, it } from "vitest";
import { SECTION_TEMPLATES } from "./proposal-meta";
import { DRAFT_SCHEMA, MAX_BRIEF_CHARS, draftOutline, draftPrompt, mockDraft, parseDraft } from "./proposal-draft";

describe("draftOutline", () => {
  it("falls back to the proposal type's default headings", () => {
    const outline = draftOutline("boq_quotation", null);
    expect(outline.map((s) => s.heading)).toEqual(SECTION_TEMPLATES.boq_quotation);
    expect(outline.every((s) => s.guidance === "")).toBe(true);
  });

  it("uses a template's sections, trimmed, without empty headings, capped at 30", () => {
    const outline = draftOutline("technical_financial", [
      { heading: "  النطاق ", guidance: " اذكر الحدود " },
      { heading: "   ", guidance: "ignored" },
      { heading: "الأسعار" },
    ]);
    expect(outline).toEqual([
      { heading: "النطاق", guidance: "اذكر الحدود" },
      { heading: "الأسعار", guidance: "" },
    ]);
    const many = Array.from({ length: 40 }, (_, i) => ({ heading: `H${i}`, guidance: "" }));
    expect(draftOutline("technical_financial", many)).toHaveLength(30);
  });

  it("uses the defaults when a template has no usable sections", () => {
    expect(draftOutline("sponsorship", [{ heading: "" }])[0].heading).toBe(SECTION_TEMPLATES.sponsorship[0]);
  });
});

describe("draftPrompt", () => {
  it("lists headings in order with their guidance and fences the brief as data", () => {
    const prompt = draftPrompt({
      type: "creative_concept",
      outline: [{ heading: "المفهوم", guidance: "فكرة رئيسية واحدة" }, { heading: "الجدول", guidance: "" }],
      company: "OnGoing",
      client: "",
      brief: "موجز العميل هنا",
    });
    expect(prompt).toContain("1. المفهوم — فكرة رئيسية واحدة");
    expect(prompt).toContain("2. الجدول\n");
    expect(prompt).toContain("Client: [العميل]");
    expect(prompt.indexOf("===== CLIENT BRIEF =====")).toBeLessThan(prompt.indexOf("موجز العميل هنا"));
    expect(prompt.trimEnd().endsWith("===== END OF BRIEF =====")).toBe(true);
  });

  it("clips very long briefs", () => {
    const prompt = draftPrompt({ type: "rfp_response", outline: [], company: "c", client: "x", brief: "a".repeat(MAX_BRIEF_CHARS + 500) });
    expect(prompt.length).toBeLessThan(MAX_BRIEF_CHARS + 1_000);
  });
});

describe("parseDraft", () => {
  const outline = [
    { heading: "الملخص", guidance: "" },
    { heading: "النطاق", guidance: "" },
  ];

  it("reads structured output and keeps the planned order", () => {
    const text = JSON.stringify({
      summary: " ملخص ",
      sections: [{ heading: "النطاق", body: "نص النطاق" }, { heading: "الملخص", body: "نص الملخص" }],
    });
    expect(parseDraft(text, outline)).toEqual({
      summary: "ملخص",
      sections: [{ heading: "الملخص", body: "نص الملخص" }, { heading: "النطاق", body: "نص النطاق" }],
    });
  });

  it("keeps a missing heading with an empty body and appends extra sections", () => {
    const text = `Here you go:\n${JSON.stringify({ summary: "s", sections: [{ heading: "إضافي", body: "x" }, { heading: "الملخص", body: "y" }] })}`;
    const draft = parseDraft(text, outline);
    expect(draft.sections).toEqual([
      { heading: "الملخص", body: "y" },
      { heading: "النطاق", body: "" },
      { heading: "إضافي", body: "x" },
    ]);
  });

  it("refuses text that is not JSON", () => {
    expect(() => parseDraft("no json here", outline)).toThrow();
    expect(() => parseDraft("{ not: valid }", outline)).toThrow();
  });

  it("matches the structured-output schema the provider is given", () => {
    expect(DRAFT_SCHEMA.required).toEqual(["summary", "sections"]);
    expect(DRAFT_SCHEMA.additionalProperties).toBe(false);
    expect(DRAFT_SCHEMA.properties.sections.items.additionalProperties).toBe(false);
  });
});

describe("mockDraft", () => {
  it("produces one clearly marked test section per heading", () => {
    const draft = mockDraft([{ heading: "أ", guidance: "توجيه" }, { heading: "ب", guidance: "" }], "عميل");
    expect(draft.summary).toContain("[مسودة اختبار]");
    expect(draft.sections.map((s) => s.heading)).toEqual(["أ", "ب"]);
    expect(draft.sections.every((s) => s.body.startsWith("[مسودة اختبار]"))).toBe(true);
    expect(draft.sections[0].body).toContain("توجيه");
  });
});
