import { describe, expect, it } from "vitest";
import { parseTemplateInput, templateSections, TEMPLATE_LIMITS } from "./proposal-templates";

const base = {
  name: " قالب الفعاليات ",
  proposal_type: "creative_concept",
  description: " للفعاليات الكبرى ",
  sections_json: JSON.stringify([{ heading: " المفهوم ", guidance: " فكرة واحدة " }, { heading: "", guidance: "x" }, { heading: "الميزانية" }]),
};

describe("parseTemplateInput", () => {
  it("trims values and drops sections without a heading", () => {
    expect(parseTemplateInput(base)).toEqual({
      ok: true,
      value: {
        name: "قالب الفعاليات",
        proposal_type: "creative_concept",
        description: "للفعاليات الكبرى",
        sections: [{ heading: "المفهوم", guidance: "فكرة واحدة" }, { heading: "الميزانية", guidance: "" }],
      },
    });
  });

  it("needs a name, a known type and at least one section", () => {
    expect(parseTemplateInput({ ...base, name: "  " }).ok).toBe(false);
    expect(parseTemplateInput({ ...base, proposal_type: "constructor" }).ok).toBe(false);
    expect(parseTemplateInput({ ...base, sections_json: "[]" }).ok).toBe(false);
    expect(parseTemplateInput({ ...base, sections_json: "{bad" }).ok).toBe(false);
    expect(parseTemplateInput({ ...base, sections_json: '{"heading":"x"}' }).ok).toBe(false);
  });

  it("refuses duplicate headings, too many sections and oversized text", () => {
    const dup = parseTemplateInput({ ...base, sections_json: JSON.stringify([{ heading: "أ" }, { heading: " أ " }]) });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toContain("مكرر");
    const many = Array.from({ length: TEMPLATE_LIMITS.sections + 1 }, (_, i) => ({ heading: `H${i}` }));
    expect(parseTemplateInput({ ...base, sections_json: JSON.stringify(many) }).ok).toBe(false);
    expect(parseTemplateInput({ ...base, sections_json: JSON.stringify([{ heading: "x".repeat(201) }]) }).ok).toBe(false);
    expect(parseTemplateInput({ ...base, name: "n".repeat(201) }).ok).toBe(false);
    expect(parseTemplateInput({ ...base, description: "d".repeat(2001) }).ok).toBe(false);
  });
});

describe("templateSections", () => {
  it("reads stored JSON defensively", () => {
    expect(templateSections(null)).toEqual([]);
    expect(templateSections([{ heading: " أ ", guidance: 3 }, "x", { guidance: "no heading" }])).toEqual([{ heading: "أ", guidance: "3" }]);
  });
});
