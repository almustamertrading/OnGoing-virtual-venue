import { describe, expect, it } from "vitest";
import {
  BOQ_CATEGORIES,
  CHECK_ORDER,
  FINANCE_CODES,
  HIGH_MARGIN_PCT,
  LOW_MARGIN_PCT,
  canonicalUnit,
  checkBoq,
  normalizeText,
  suggestCategory,
  type BoqCheckResult,
  type BoqLine,
  type FindingCode,
} from "./boq-check";

/** Lines with ids line-1, line-2, …; each defaults to a clean, priced, distinct line. */
const boq = (...overrides: Partial<BoqLine>[]): BoqLine[] =>
  overrides.map((over, i) => ({
    id: `line-${i + 1}`,
    description: `Clean reference row ${i + 1} with full specification`,
    unit: "nos",
    quantity: 10,
    unit_price: 100,
    ...over,
  }));

/** "line:code" for every finding, in output order. */
const codes = (result: BoqCheckResult) => result.findings.map((f) => `${f.line}:${f.code}`);
const find = (result: BoqCheckResult, line: number, code: FindingCode) =>
  result.findings.find((f) => f.line === line && f.code === code);

const noFinance = { finance: false };
const finance = { finance: true };

describe("normalizeText", () => {
  it("lower-cases and collapses spaces and punctuation", () => {
    expect(normalizeText("  LED   Screen,  (Main Hall)!! ")).toBe("led screen main hall");
    expect(normalizeText("Ushers / Hostesses - VIP")).toBe("ushers hostesses vip");
  });

  it("strips Arabic diacritics and tatweel", () => {
    expect(normalizeText("شَاشَـــة عَرْض")).toBe("شاشه عرض");
    expect(normalizeText("الرَّئِيسِيّ")).toBe(normalizeText("الرئيسي"));
  });

  it("unifies أ إ آ to ا, ة to ه and ى to ي", () => {
    expect(normalizeText("أ إ آ ا")).toBe("ا ا ا ا");
    expect(normalizeText("إضاءة")).toBe("اضاءه");
    expect(normalizeText("مبنى")).toBe("مبني");
    expect(normalizeText("إضاءة المسرح الرئيسى")).toBe(normalizeText("اضاءه المسرح الرئيسي"));
  });

  it("turns Arabic-Indic digits into 0-9 and writes sizes one way", () => {
    expect(normalizeText("شاشة ٣×٢ م")).toBe("شاشه 3 x 2 م");
    expect(normalizeText("Stage 10x6m")).toBe(normalizeText("stage 10 × 6 M"));
    expect(normalizeText("Stage 10*6 m")).toBe("stage 10 x 6 m");
  });

  it("is empty for missing text", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(" .,- ")).toBe("");
  });
});

describe("canonicalUnit", () => {
  const cases: Record<string, string[]> = {
    m2: ["m2", "M2", "sqm", "SQM", "Sq.m", "sq m", "m²", "M²", "م2", "م٢", "م²", "متر مربع", "Square meters"],
    m: ["m", "M", "lm", "LM", "rm", "م", "متر", "متر طولي", "meters", "Linear metre"],
    nos: ["nos", "Nos.", "No", "No.", "pcs", "PCS", "pc", "ea", "EA", "each", "pieces", "عدد", "حبة", "حبه", "قطعة"],
    ls: ["ls", "LS", "L.S.", "l/s", "lump sum", "Lump-Sum", "lumpsum", "lot", "مقطوعية", "مقطوعيه"],
    day: ["day", "Days", "يوم", "أيام", "ايام", "per day", "/day", "لكل يوم"],
    hr: ["hr", "Hrs", "hour", "hours", "ساعة", "ساعات"],
    set: ["set", "Sets", "طقم", "أطقم"],
    kg: ["kg", "KG", "kgs", "كجم", "كغ"],
    person: ["person", "persons", "pax", "PAX", "شخص", "أشخاص", "per person"],
  };
  for (const [canonical, variants] of Object.entries(cases)) {
    it(`normalises the ${canonical} synonyms`, () => {
      for (const variant of variants) expect(canonicalUnit(variant), variant).toBe(canonical);
    });
  }

  it("is null for an unknown or empty unit", () => {
    expect(canonicalUnit("pallet")).toBeNull();
    expect(canonicalUnit("شوال")).toBeNull();
    expect(canonicalUnit("")).toBeNull();
    expect(canonicalUnit("   ")).toBeNull();
    expect(canonicalUnit(null)).toBeNull();
    expect(canonicalUnit(undefined)).toBeNull();
  });
});

describe("checkBoq", () => {
  it("finds nothing on a clean BOQ and still counts its lines", () => {
    const result = checkBoq(boq({}, {}, {}), noFinance);
    expect(result.findings).toEqual([]);
    expect(result.summary).toEqual({ critical: 0, warning: 0, info: 0, linesChecked: 3 });
  });

  it("handles an empty BOQ", () => {
    expect(checkBoq([], noFinance)).toEqual({
      findings: [],
      summary: { critical: 0, warning: 0, info: 0, linesChecked: 0 },
      categories: [],
    });
    expect(checkBoq([], finance).findings).toEqual([]);
  });

  it("never changes its input", () => {
    const lines = boq({ quantity: null }, { description: "Clean reference row 1 with full specification", unit: "m2" });
    const frozen = Object.freeze(lines.map((l) => Object.freeze({ ...l })));
    const snapshot = JSON.stringify(frozen);
    expect(() => checkBoq(frozen, finance)).not.toThrow();
    expect(JSON.stringify(frozen)).toBe(snapshot);
  });

  describe("missing_quantity", () => {
    it("is a warning when the line has no quantity and no price", () => {
      const result = checkBoq(boq({ quantity: null, unit_price: null }), noFinance);
      expect(find(result, 1, "missing_quantity")).toMatchObject({ severity: "warning", lineId: "line-1", message: "الكمية غير محددة." });
    });

    it("treats a zero quantity as missing", () => {
      expect(find(checkBoq(boq({ quantity: 0, unit_price: 0 }), noFinance), 1, "missing_quantity")?.severity).toBe("warning");
    });

    it("is critical when the line is priced", () => {
      const result = checkBoq(boq({ quantity: null, unit_price: 350 }, { quantity: 0, unit_price: 20 }), noFinance);
      expect(find(result, 1, "missing_quantity")?.severity).toBe("critical");
      expect(find(result, 2, "missing_quantity")?.severity).toBe("critical");
      expect(find(result, 1, "missing_quantity")?.message).toContain("مسعّر بلا كمية");
    });

    it("is not raised for a real quantity", () => {
      expect(find(checkBoq(boq({ quantity: 0.5 }), noFinance), 1, "missing_quantity")).toBeUndefined();
    });
  });

  describe("unpriced", () => {
    it("is a warning for a missing or zero price", () => {
      const result = checkBoq(boq({ unit_price: null }, { unit_price: 0 }), noFinance);
      expect(find(result, 1, "unpriced")).toMatchObject({ severity: "warning", message: "البند غير مسعّر بعد." });
      expect(find(result, 2, "unpriced")?.severity).toBe("warning");
    });

    it("is not raised for an optional line or a priced one", () => {
      const result = checkBoq(boq({ unit_price: 0, is_optional: true }, { unit_price: 1 }), noFinance);
      expect(result.findings).toEqual([]);
    });
  });

  describe("missing_unit and unknown_unit", () => {
    it("warns about an empty unit", () => {
      const result = checkBoq(boq({ unit: null }, { unit: "" }, { unit: "  " }), noFinance);
      expect(codes(result)).toEqual(["1:missing_unit", "2:missing_unit", "3:missing_unit"]);
      expect(result.findings.every((f) => f.severity === "warning")).toBe(true);
    });

    it("notes a unit outside the list, quoting it", () => {
      const result = checkBoq(boq({ unit: "pallet" }), noFinance);
      expect(find(result, 1, "unknown_unit")).toMatchObject({ severity: "info" });
      expect(find(result, 1, "unknown_unit")?.message).toContain("«pallet»");
    });

    it("accepts Arabic and English synonyms", () => {
      const units = ["sqm", "م2", "متر مربع", "LM", "متر طولي", "pcs", "حبة", "L.S.", "مقطوعية", "days", "ساعة", "طقم", "كجم", "شخص"];
      expect(checkBoq(boq(...units.map((unit) => ({ unit }))), noFinance).findings).toEqual([]);
    });
  });

  describe("duplicate", () => {
    it("matches descriptions that differ only by case, spacing, punctuation and Arabic spelling", () => {
      const result = checkBoq(
        boq(
          { description: "شاشة LED مقاس ٣×٢ م - القاعة الرئيسية" },
          { description: "Clean other row" },
          { description: "شاشه led  مقاس 3x2م، القاعه الرئيسيه" },
        ),
        noFinance,
      );
      expect(find(result, 1, "duplicate")).toMatchObject({ severity: "warning", related: [3] });
      expect(find(result, 3, "duplicate")).toMatchObject({ severity: "warning", related: [1] });
      expect(find(result, 1, "duplicate")?.message).toBe("الوصف نفسه مكرر في البند 3.");
      expect(find(result, 2, "duplicate")).toBeUndefined();
    });

    it("matches hamza forms, alef maqsura, diacritics and tatweel", () => {
      const result = checkBoq(
        boq({ description: "إضاءة المسرح الرئيسى" }, { description: "اضاءه المسرح الرئيسي" }, { description: "إِضَـاءَة الْمَسْرَح الرَّئِيسِيّ" }),
        noFinance,
      );
      expect(result.findings.filter((f) => f.code === "duplicate").map((f) => [f.line, f.related])).toEqual([
        [1, [2, 3]],
        [2, [1, 3]],
        [3, [1, 2]],
      ]);
      expect(find(result, 2, "duplicate")?.message).toBe("الوصف نفسه مكرر في البنود 1، 3.");
    });

    it("does not group different descriptions", () => {
      const result = checkBoq(boq({ description: "LED screen 3x2m" }, { description: "LED screen 4x3m" }), noFinance);
      expect(result.findings.filter((f) => f.code === "duplicate")).toEqual([]);
    });
  });

  describe("unit_conflict", () => {
    it("flags the same description with different units on each line", () => {
      const result = checkBoq(
        boq({ description: "LED screen 3x2m", unit: "m2" }, { description: "led screen 3 x 2 m", unit: "Nos" }),
        noFinance,
      );
      expect(codes(result)).toEqual(["1:duplicate", "2:duplicate", "1:unit_conflict", "2:unit_conflict"]);
      expect(find(result, 1, "unit_conflict")).toMatchObject({ severity: "warning", related: [2] });
      expect(find(result, 1, "unit_conflict")?.message).toContain("«m2» مقابل «Nos»");
      expect(find(result, 2, "unit_conflict")?.message).toContain("«Nos» مقابل «m2»");
    });

    it("treats synonyms as the same unit", () => {
      const result = checkBoq(boq({ description: "Carpet tiles", unit: "sqm" }, { description: "carpet  tiles", unit: "م²" }), noFinance);
      expect(result.findings.some((f) => f.code === "unit_conflict")).toBe(false);
    });

    it("leaves lines without a unit out of the comparison", () => {
      const result = checkBoq(boq({ description: "Carpet tiles", unit: "m2" }, { description: "Carpet tiles", unit: "" }), noFinance);
      expect(result.findings.some((f) => f.code === "unit_conflict")).toBe(false);
      expect(find(result, 2, "missing_unit")).toBeDefined();
    });

    it("compares unknown units by how they are written", () => {
      const result = checkBoq(boq({ description: "Carpet tiles", unit: "roll" }, { description: "Carpet tiles", unit: "box" }), noFinance);
      expect(find(result, 1, "unit_conflict")?.related).toEqual([2]);
    });
  });

  describe("quantity_conflict", () => {
    it("notes the same description and unit with different quantities", () => {
      const result = checkBoq(
        boq({ description: "Round tables 180cm", unit: "pcs", quantity: 30 }, { description: "Round Tables (180 cm)", unit: "عدد", quantity: 32.5 }),
        noFinance,
      );
      expect(find(result, 1, "quantity_conflict")).toMatchObject({ severity: "info", related: [2] });
      expect(find(result, 1, "quantity_conflict")?.message).toContain("30 مقابل 32.5");
      expect(find(result, 2, "quantity_conflict")?.message).toContain("32.5 مقابل 30");
    });

    it("is not raised for equal quantities, different units or a missing quantity", () => {
      const same = checkBoq(boq({ description: "Round tables", quantity: 30 }, { description: "Round tables", quantity: 30 }), noFinance);
      const units = checkBoq(boq({ description: "Round tables", unit: "pcs", quantity: 30 }, { description: "Round tables", unit: "set", quantity: 5 }), noFinance);
      const missing = checkBoq(boq({ description: "Round tables", quantity: 30 }, { description: "Round tables", quantity: null }), noFinance);
      for (const result of [same, units, missing]) {
        expect(result.findings.some((f) => f.code === "quantity_conflict")).toBe(false);
      }
    });
  });

  describe("provisional_sum", () => {
    const flagged = [
      "Provisional sum for municipality permits",
      "PS for civil defence approvals",
      "P.S. – wayfinding signage",
      "Prime cost sum for VIP gifts",
      "PC sum: floral arrangements",
      "Contingency 10%",
      "مبلغ احتياطي للطوارئ",
      "المبلغ الاحتياطي للفعالية",
      "مبالغ احتياطية لأعمال إضافية",
      "مبلغ تقديري لرسوم البلدية",
      "احتياطي عام للمشروع",
      "الاحتياطي العام",
    ];
    for (const description of flagged) {
      it(`flags "${description}"`, () => {
        expect(find(checkBoq(boq({ description }), noFinance), 1, "provisional_sum")).toMatchObject({
          severity: "info",
          message: "مبلغ احتياطي أو تقديري: أكّد طريقة احتسابه مع العميل.",
        });
      });
    }

    const clean = [
      "Stage lamps and theatre props",
      "PS4 gaming stations for the youth zone",
      "مولد كهرباء احتياطي 500 كيلوفولت أمبير",
      "Photo booth with printed props",
    ];
    for (const description of clean) {
      it(`does not flag "${description}"`, () => {
        expect(find(checkBoq(boq({ description }), noFinance), 1, "provisional_sum")).toBeUndefined();
      });
    }
  });

  describe("vague_description", () => {
    it("notes descriptions with fewer than 8 letters and digits", () => {
      const result = checkBoq(boq({ description: "Misc" }, { description: "LED 3x2" }, { description: "شاشة" }, { description: "- - -" }), noFinance);
      expect(result.findings.filter((f) => f.code === "vague_description").map((f) => f.line)).toEqual([1, 2, 3, 4]);
      expect(find(result, 1, "vague_description")).toMatchObject({ severity: "info", message: "الوصف مختصر جدًا: ينقصه تفصيل المواصفات." });
    });

    it("accepts 8 or more", () => {
      const result = checkBoq(boq({ description: "Stage 10x6m" }, { description: "كراسي حفلات" }, { description: "abcdefgh" }), noFinance);
      expect(result.findings.some((f) => f.code === "vague_description")).toBe(false);
    });
  });

  describe("finance checks", () => {
    it("flags a price below cost as critical", () => {
      const result = checkBoq(boq({ unit_price: 900, unit_cost: 1000 }), finance);
      expect(codes(result)).toEqual(["1:below_cost"]);
      expect(find(result, 1, "below_cost")).toMatchObject({ severity: "critical", message: "سعر البيع أقل من التكلفة الداخلية: البند يُباع بخسارة." });
    });

    it("warns about a margin under 10%, never rounding the figure up to the threshold", () => {
      const result = checkBoq(boq({ unit_price: 9000, unit_cost: 8600.75 }, { unit_price: 100, unit_cost: 100 }, { unit_price: 10000, unit_cost: 9001 }), finance);
      expect(find(result, 1, "low_margin")).toMatchObject({ severity: "warning", message: "هامش الربح 4.4% فقط، أقل من 10%." });
      expect(find(result, 2, "low_margin")?.message).toContain("هامش الربح 0%");
      expect(find(result, 3, "low_margin")?.message).toContain("هامش الربح 9.9%");
    });

    it("notes a margin over 80% as an outlier", () => {
      const result = checkBoq(boq({ unit_price: 1000, unit_cost: 150 }, { unit_price: 100000, unit_cost: 19990 }), finance);
      expect(find(result, 1, "high_margin")).toMatchObject({ severity: "info", message: "هامش الربح 85%، أعلى من 80%: راجع السعر والتكلفة." });
      expect(find(result, 2, "high_margin")?.message).toContain("هامش الربح 80.1%");
    });

    it("accepts the thresholds themselves and normal margins", () => {
      const result = checkBoq(
        boq({ unit_price: 100, unit_cost: 100 - LOW_MARGIN_PCT }, { unit_price: 100, unit_cost: 100 - HIGH_MARGIN_PCT }, { unit_price: 30000, unit_cost: 18000 }),
        finance,
      );
      expect(result.findings).toEqual([]);
    });

    it("notes a priced line without a cost", () => {
      const result = checkBoq(boq({ unit_cost: null }, { unit_cost: 0 }), finance);
      expect(codes(result)).toEqual(["1:missing_cost", "2:missing_cost"]);
      expect(find(result, 1, "missing_cost")).toMatchObject({ severity: "info", message: "البند مسعّر بلا تكلفة داخلية: لا يمكن حساب هامشه." });
    });

    it("leaves cost checks to unpriced lines' own finding", () => {
      const result = checkBoq(boq({ unit_price: null, unit_cost: 500 }, { unit_price: 0, unit_cost: null }), finance);
      expect(codes(result)).toEqual(["1:unpriced", "2:unpriced"]);
    });

    it("runs no cost check without the finance flag, even when costs are given", () => {
      const lines = boq({ unit_price: 900, unit_cost: 48750.25 }, { unit_price: 9000, unit_cost: 8600.75 }, { unit_cost: null }, { unit_price: 1000, unit_cost: 1 });
      const result = checkBoq(lines, noFinance);
      expect(result.findings).toEqual([]);
      const text = JSON.stringify(result);
      for (const figure of ["48750", "48,750", "8600", "8,600"]) expect(text).not.toContain(figure);
    });

    it("runs no cost check for lines without a cost field, even for finance", () => {
      expect(checkBoq(boq({ unit_price: 900 }), finance).findings).toEqual([]);
    });

    it("covers exactly the documented finance codes", () => {
      const lines = boq({ unit_price: 900, unit_cost: 1000 }, { unit_price: 100, unit_cost: 95 }, { unit_price: 100, unit_cost: 5 }, { unit_cost: 0 });
      const found = new Set(checkBoq(lines, finance).findings.map((f) => f.code));
      expect([...found].sort()).toEqual([...FINANCE_CODES].sort());
      expect(checkBoq(lines, noFinance).findings.filter((f) => FINANCE_CODES.includes(f.code))).toEqual([]);
    });
  });

  it("orders findings by severity, then by check, then by line", () => {
    const result = checkBoq(
      boq(
        { unit_price: null }, // 1: unpriced
        { description: "Misc" }, // 2: vague
        { quantity: null, unit_price: 50 }, // 3: missing quantity (critical)
        { unit_price: 80, unit_cost: 100 }, // 4: below cost (critical)
        { description: "Round tables", unit: "pallet" }, // 5: duplicate, unit conflict, unknown unit
        { description: "Round tables", unit: null }, // 6: duplicate, missing unit
        { quantity: 0, unit_price: null }, // 7: missing quantity, unpriced
      ),
      finance,
    );
    expect(codes(result)).toEqual([
      "4:below_cost",
      "3:missing_quantity",
      "7:missing_quantity",
      "5:duplicate",
      "6:duplicate",
      "6:missing_unit",
      "1:unpriced",
      "7:unpriced",
      "5:unknown_unit",
      "2:vague_description",
    ]);
    expect(result.summary).toEqual({ critical: 2, warning: 6, info: 2, linesChecked: 7 });
    // Every code has a place in the order.
    expect(new Set(CHECK_ORDER).size).toBe(13);
  });

  it("numbers lines by position and keeps their ids", () => {
    const lines = boq({ id: "b-9", unit_price: null }, { id: "a-1" }, { id: "c-5", unit: null });
    const result = checkBoq(lines, noFinance);
    expect(result.findings.map((f) => [f.lineId, f.line])).toEqual([
      ["c-5", 3],
      ["b-9", 1],
    ]);
  });

  it("groups lines by suggested category in order of first appearance", () => {
    const lines = boq(
      { id: "a", description: "Banquet chairs with white covers" },
      { id: "b", description: "LED screen 5x3m with processor" },
      { id: "c", description: "QA unnamed reference line" },
      { id: "d", description: "طاولات مستديرة مع مفارش" },
    );
    expect(checkBoq(lines, noFinance).categories).toEqual([
      { category: "الأثاث", lineIds: ["a", "d"] },
      { category: "صوت وإضاءة وشاشات", lineIds: ["b"] },
    ]);
  });
});

describe("suggestCategory", () => {
  const examples: [string, string][] = [
    ["LED screen 5x3m for main stage backdrop", "صوت وإضاءة وشاشات"],
    ["Sound system with 2 wireless microphones", "صوت وإضاءة وشاشات"],
    ["Stage lighting package", "صوت وإضاءة وشاشات"],
    ["شاشات عرض LED", "صوت وإضاءة وشاشات"],
    ["إضاءة القاعة والممرات", "صوت وإضاءة وشاشات"],
    ["Stage platform 12x8m with stairs", "المسرح والإنشاءات"],
    ["Truss structure for branding", "المسرح والإنشاءات"],
    ["منصة المسرح الرئيسية", "المسرح والإنشاءات"],
    ["Banquet chairs", "الأثاث"],
    ["VIP sofas and coffee tables", "الأثاث"],
    ["تأجير الكراسي والطاولات", "الأثاث"],
    ["Coffee break and buffet lunch", "الضيافة"],
    ["Catering for 300 guests", "الضيافة"],
    ["ضيافة وبوفيه عشاء", "الضيافة"],
    ["Printing of roll-up banners", "الطباعة واللوحات"],
    ["Wayfinding signage", "الطباعة واللوحات"],
    ["طباعة لوحات إرشادية", "الطباعة واللوحات"],
    ["Ushers and hostesses", "الطواقم"],
    ["Event crew and manpower", "الطواقم"],
    ["منظمين ومضيفات للاستقبال", "الطواقم"],
    ["Security guards (night shift)", "الأمن والسلامة"],
    ["First aid station with paramedic", "الأمن والسلامة"],
    ["حراسة أمنية وإسعافات أولية", "الأمن والسلامة"],
    ["Bus transport for guests", "النقل واللوجستيات"],
    ["Forklift and logistics support", "النقل واللوجستيات"],
    ["نقل المعدات بالشاحنات", "النقل واللوجستيات"],
    ["Marquee tent 20x30m", "الخيام والأرضيات"],
    ["Carpet and raised flooring", "الخيام والأرضيات"],
    ["خيمة مكيفة مع سجاد", "الخيام والأرضيات"],
    ["Generator 500 kVA with power cables", "الكهرباء"],
    ["مولد كهرباء احتياطي", "الكهرباء"],
    ["Photography and videography", "التصوير والبث"],
    ["Live streaming with drone footage", "التصوير والبث"],
    ["Photo booth with instant prints", "التصوير والبث"],
    ["تصوير فوتوغرافي وفيديو وبث مباشر", "التصوير والبث"],
    ["Fresh flowers and table decor", "الديكور"],
    ["Backdrop with floral arch", "الديكور"],
    ["ورود طبيعية وديكورات", "الديكور"],
    ["Municipality event permit", "التصاريح"],
    ["Civil defence licence", "التصاريح"],
    ["تصاريح البلدية والدفاع المدني", "التصاريح"],
  ];
  for (const [description, category] of examples) {
    it(`"${description}" → ${category}`, () => {
      expect(suggestCategory(description)).toBe(category);
    });
  }

  it("is null when no keyword matches", () => {
    expect(suggestCategory("QA unnamed reference line")).toBeNull();
    expect(suggestCategory("بند عام")).toBeNull();
    expect(suggestCategory("")).toBeNull();
    expect(suggestCategory(null)).toBeNull();
  });

  it("matches whole words, not parts of them", () => {
    expect(suggestCategory("Business class")).toBeNull(); // not "bus"
    expect(suggestCategory("Team building session")).toBeNull(); // not "tea"
    expect(suggestCategory("Design fee")).toBeNull(); // not "sign"
  });

  it("only returns known categories", () => {
    expect(BOQ_CATEGORIES).toHaveLength(13);
    for (const [description] of examples) expect(BOQ_CATEGORIES).toContain(suggestCategory(description));
  });
});
