import { describe, expect, it } from "vitest";
import { BOQ_EXTRACT_SCHEMA, boqPrompt, mockBoqOutput, normalizeQuantity, parseBoqLines } from "./boq-extract";

const pages = [
  "General conditions of the event tender. Prices are excluded from this document.",
  "Bill of quantities\n1.1 LED screen 3x2m 2 nos\n1.2 Truss structure 24 m\n1.3 Stage carpet as per drawing\n2.1 كراسي ضيافة ١٬٢٠٠ عدد",
];
const line = (over: Record<string, unknown>) => ({
  item_ref: "1.1", description: "LED screen 3x2m", unit: "nos", quantity: "2", section: "Screens", page: 2,
  excerpt: "1.1 LED screen 3x2m 2 nos", note: "", ...over,
});
const parse = (lines: unknown[]) => parseBoqLines(JSON.stringify({ lines }), pages);

describe("normalizeQuantity", () => {
  it("keeps one plain number, normalising separators and digits", () => {
    expect(normalizeQuantity("2")).toBe("2");
    expect(normalizeQuantity("1,200")).toBe("1200");
    expect(normalizeQuantity("١٬٢٠٠")).toBe("1200");
    expect(normalizeQuantity("12.50")).toBe("12.5");
    expect(normalizeQuantity(" 24 ")).toBe("24");
  });

  it("refuses anything that is not a single stated quantity", () => {
    for (const raw of ["", "lump sum", "2-3", "2 x 4", "approx 10", "10%", "-5", "1e5"]) expect(normalizeQuantity(raw)).toBe("");
  });
});

describe("parseBoqLines", () => {
  it("checks the quote against its page and the quantity against the quote", () => {
    const [r] = parse([line({})]);
    expect(r).toMatchObject({
      title: "LED screen 3x2m", page: 2, verified: true, severity: "info",
      data: { item_ref: "1.1", unit: "nos", quantity: "2", section: "Screens", quantity_in_source: true },
    });
    expect(r.data.checks).toEqual([
      { label: "النص المقتبس موجود في الصفحة", ok: true },
      { label: "الكمية موجودة في النص المقتبس", ok: true },
    ]);
    expect(r.detail).toBe("البند 1.1 · الكمية: 2 · الوحدة: nos · القسم: Screens");
  });

  it("flags a quantity that the quoted text does not contain", () => {
    const [r] = parse([line({ quantity: "20" })]);
    expect(r).toMatchObject({ verified: true, severity: "warning", data: { quantity: "20", quantity_in_source: false } });
    expect(r.data.checks[1]).toEqual({ label: "لم تُعثر على الكمية في النص المقتبس، تحقّق منها", ok: false });
  });

  it("never guesses a missing quantity", () => {
    const [r] = parse([line({ item_ref: "1.3", description: "Stage carpet as per drawing", quantity: "", unit: "", excerpt: "1.3 Stage carpet as per drawing" })]);
    expect(r).toMatchObject({ severity: "warning", data: { quantity: "", quantity_in_source: false } });
    expect(r.data.checks[1]).toEqual({ label: "الكمية غير مذكورة في الملف", ok: false });
    expect(r.detail).toContain("الكمية: غير محددة");
  });

  it("reads Arabic lines and digits", () => {
    const [r] = parse([line({ item_ref: "2.1", description: "كراسي ضيافة", unit: "عدد", quantity: "١٬٢٠٠", excerpt: "2.1 كراسي ضيافة ١٬٢٠٠ عدد" })]);
    expect(r).toMatchObject({ verified: true, data: { quantity: "1200", quantity_in_source: true } });
  });

  it("corrects a wrong page and marks an invented quote as unverified", () => {
    const [moved, invented] = parse([
      line({ page: 1 }),
      line({ excerpt: "1.9 Fireworks display 3 shows", description: "Fireworks", quantity: "3" }),
    ]);
    expect(moved).toMatchObject({ page: 2, verified: true, data: { page_corrected: true } });
    expect(invented).toMatchObject({ verified: false, severity: "warning" });
    expect(invented.data.checks[0]).toEqual({ label: "لم يُعثر على النص المقتبس في الصفحة", ok: false });
  });

  it("skips empty and malformed lines, and fails clearly on non-JSON", () => {
    expect(parse([line({ description: "  " }), null, "x", 5]).length).toBe(0);
    expect(parseBoqLines('{"lines": "none"}', pages)).toEqual([]);
    expect(() => parseBoqLines("no json", pages)).toThrow("unparseable");
    // A page outside the document is treated as unknown, then located from the quote.
    const [r] = parse([line({ page: 99 })]);
    expect(r.page).toBe(2);
  });
});

describe("mockBoqOutput", () => {
  it("lists item lines from the document's own text, with or without a quantity", () => {
    const { lines } = mockBoqOutput(pages) as { lines: Record<string, unknown>[] };
    expect(lines.map((l) => [l.item_ref, l.quantity, l.unit])).toEqual([
      ["1.1", "2", "nos"], ["1.2", "24", "m"], ["1.3", "", ""], ["2.1", "", ""],
    ]);
    const parsed = parseBoqLines(JSON.stringify({ lines }), pages);
    expect(parsed.every((l) => l.verified)).toBe(true);
    expect(parsed.filter((l) => l.data.quantity_in_source).map((l) => l.data.item_ref)).toEqual(["1.1", "1.2"]);
  });
});

describe("schema and prompt", () => {
  it("requires every property and allows no others (structured outputs)", () => {
    const item = BOQ_EXTRACT_SCHEMA.properties.lines.items;
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort());
    expect(item.additionalProperties).toBe(false);
  });

  it("fences the document and says when pages were left out", () => {
    const prompt = boqPrompt({ text: "[[page 1]]\nx", includedPages: 1, totalPages: 3, truncated: true });
    expect(prompt).toContain("Only pages 1 to 1 of 3 are included below.");
    expect(prompt).toMatch(/===== TENDER DOCUMENT =====\n\[\[page 1\]\]\nx\n===== END OF DOCUMENT =====$/);
  });
});
