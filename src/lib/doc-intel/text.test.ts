import { describe, expect, it } from "vitest";
import { locateExcerpt, normalizeForMatch, pagedText, sentences } from "./text";

describe("normalizeForMatch", () => {
  it("ignores case, punctuation, diacritics, tatweel and Arabic letter variants", () => {
    expect(normalizeForMatch("Bid  Bond, 5%!")).toBe("bid bond 5");
    expect(normalizeForMatch("الضَّمانُ الابتدائـــي")).toBe(normalizeForMatch("الضمان الابتدائي"));
    expect(normalizeForMatch("إقرار أحكام آخر")).toBe("اقرار احكام اخر");
    expect(normalizeForMatch("شهادة الزكاة")).toBe("شهاده الزكاه");
    expect(normalizeForMatch("على مستوى")).toBe("علي مستوي");
  });
});

describe("locateExcerpt", () => {
  const pages = ["Introduction to the tender.", "A valid commercial registration must be attached.", "Bid bond of 2% is required."];

  it("verifies an excerpt on the cited page", () => {
    expect(locateExcerpt(pages, 2, "valid commercial registration must be attached")).toEqual({ verified: true, page: 2, corrected: false });
  });

  it("finds the right page when the citation is wrong, and says so", () => {
    expect(locateExcerpt(pages, 1, "Bid bond of 2% is required")).toEqual({ verified: true, page: 3, corrected: true });
  });

  it("does not verify text that is not in the document, or that is too short to prove anything", () => {
    expect(locateExcerpt(pages, 2, "An insurance certificate is required")).toEqual({ verified: false, page: 2, corrected: false });
    expect(locateExcerpt(pages, 3, "bond")).toEqual({ verified: false, page: 3, corrected: false });
  });

  it("drops page numbers outside the document", () => {
    expect(locateExcerpt(pages, 9, "nothing like this anywhere")).toEqual({ verified: false, page: null, corrected: false });
  });
});

describe("pagedText", () => {
  it("marks every page so the model can cite it", () => {
    const p = pagedText(["one", "two"], 1000);
    expect(p.text).toContain("[[page 1]]\none");
    expect(p.text).toContain("[[page 2]]\ntwo");
    expect(p).toMatchObject({ includedPages: 2, totalPages: 2, truncated: false });
  });

  it("keeps whole pages within the budget and reports truncation", () => {
    const p = pagedText(["a".repeat(500), "b".repeat(500), "c".repeat(500)], 1100);
    expect(p.includedPages).toBe(2);
    expect(p.truncated).toBe(true);
  });

  it("always includes the first page, clipped if it alone is too long", () => {
    const p = pagedText(["x".repeat(5000)], 1000);
    expect(p.includedPages).toBe(1);
    expect(p.text.length).toBeLessThanOrEqual(1000);
  });
});

describe("sentences", () => {
  it("splits on sentence ends and lines, dropping fragments", () => {
    expect(sentences("First full sentence here. Second one is here too!\nok")).toEqual([
      "First full sentence here.",
      "Second one is here too!",
    ]);
  });
});
