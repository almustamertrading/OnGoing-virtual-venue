/**
 * BOQ checker (Workflow B "BOQ intelligence", first increment): rule-based checks that catch
 * bill-of-quantities problems before anything is priced or sent to a client.
 *
 * It only reports. Nothing is ever changed automatically. Pure (no React, no Supabase), so the
 * same rules run on the server, in the browser and in unit tests.
 */

export type Severity = "critical" | "warning" | "info";

export type FindingCode =
  | "missing_quantity"
  | "unpriced"
  | "missing_unit"
  | "unknown_unit"
  | "duplicate"
  | "unit_conflict"
  | "quantity_conflict"
  | "provisional_sum"
  | "vague_description"
  | "below_cost"
  | "low_margin"
  | "high_margin"
  | "missing_cost";

export type BoqLine = {
  id: string;
  description: string;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  /** Internal cost. Pass it for finance users only: finance checks skip lines without this field. */
  unit_cost?: number | null;
  /** Optional proposal lines are offered to the client but not charged, so they need no price. */
  is_optional?: boolean;
};

export type BoqCheckOptions = {
  /** The viewer may see internal costs (finance_access). Without it no cost-based check runs. */
  finance: boolean;
};

export type Finding = {
  lineId: string;
  /** 1-based position of the line in the given order. */
  line: number;
  code: FindingCode;
  severity: Severity;
  /** Arabic, ready to show. Mentions cost-based figures only when `finance` is true. */
  message: string;
  /** The other line numbers involved (duplicates and conflicts), ascending. */
  related?: number[];
};

export type BoqCheckSummary = { critical: number; warning: number; info: number; linesChecked: number };

export type BoqCategoryGroup = { category: string; lineIds: string[] };

export type BoqCheckResult = {
  /** Sorted by severity, then by check (see CHECK_ORDER), then by line number. */
  findings: Finding[];
  summary: BoqCheckSummary;
  /** Lines grouped by suggested category, in order of first appearance. Uncategorised lines are left out. */
  categories: BoqCategoryGroup[];
};

export const LOW_MARGIN_PCT = 10;
export const HIGH_MARGIN_PCT = 80;
/** A description with fewer letters and digits than this lacks specification detail. */
export const MIN_DESCRIPTION_CHARS = 8;

export const SEVERITY_ORDER: readonly Severity[] = ["critical", "warning", "info"];

/** Within one severity, findings are listed in this order (most actionable first), then by line. */
export const CHECK_ORDER: readonly FindingCode[] = [
  "below_cost",
  "missing_quantity",
  "duplicate",
  "unit_conflict",
  "low_margin",
  "missing_unit",
  "unpriced",
  "quantity_conflict",
  "provisional_sum",
  "unknown_unit",
  "vague_description",
  "high_margin",
  "missing_cost",
];

/** Checks that read internal costs: they run only with `finance: true`. */
export const FINANCE_CODES: readonly FindingCode[] = ["below_cost", "low_margin", "high_margin", "missing_cost"];

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

/**
 * Text as the checks compare it: lower case; Arabic diacritics and tatweel removed; أ/إ/آ → ا,
 * ة → ه, ى → ي; Arabic-Indic digits → 0-9; "3×2م" and "3 x 2 م" written the same way; every run of
 * spaces or punctuation collapsed to one space.
 */
export function normalizeText(value: string | null | undefined): string {
  return normalize(value, true);
}

/** `splitNumbers` writes "3x2m" as "3 x 2 m"; without it "PS4" stays one word. */
function normalize(value: string | null | undefined, splitNumbers: boolean): string {
  if (!value) return "";
  let text = value
    // Compatibility forms (², ligatures, Arabic presentation forms) plus canonical decomposition,
    // which splits أ إ آ ؤ ئ into the base letter and a hamza or madda mark.
    .normalize("NFKD")
    // Combining marks: Arabic diacritics (tashkeel), those hamza/madda marks and Latin accents.
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "") // tatweel ـ
    .replace(/ٱ/g, "ا") // alef wasla ٱ → ا
    .replace(/ة/g, "ه") // ة → ه
    .replace(/[ىی]/g, "ي") // ى and Persian ی → ي
    .replace(/ک/g, "ك") // Persian ک → ك
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase();
  if (splitNumbers) {
    // Dimensions: "3×2", "3*2", "3x2" and "3 x 2" are the same size.
    text = text
      .replace(/(\d)\s*[×*]\s*(?=\d)/g, "$1x")
      .replace(/(\p{N})(?=\p{L})/gu, "$1 ")
      .replace(/(\p{L})(?=\p{N})/gu, "$1 ");
  }
  return text.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const LATIN_WORD = /^[a-z]+$/;

/** Singular candidates of an English word: "chairs" → chair, "buses" → bus, "batteries" → battery. */
function latinVariants(token: string): string[] {
  const out: string[] = [];
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) out.push(token.slice(0, -1));
  if (token.length > 4 && token.endsWith("es")) out.push(token.slice(0, -2));
  if (token.length > 4 && token.endsWith("ies")) out.push(`${token.slice(0, -3)}y`);
  return out;
}

/** An Arabic word without its article or a one-letter prefix: "والصوت" → صوت, "لتصاريح" → تصاريح. */
function arabicVariants(token: string): string[] {
  const out = new Set<string>();
  const stripArticle = (t: string) => {
    if ((t.startsWith("لل") || t.startsWith("ال")) && t.length >= 4) out.add(t.slice(2));
  };
  stripArticle(token);
  if (/^[وفبلك]/.test(token) && token.length >= 4) {
    const rest = token.slice(1);
    out.add(rest);
    stripArticle(rest);
  }
  out.delete(token);
  return [...out];
}

/** The word itself plus the forms it is matched under. */
function tokenVariants(token: string): string[] {
  return [token, ...(LATIN_WORD.test(token) ? latinVariants(token) : arabicVariants(token))];
}

/** Each word of a description with its variants. */
function words(description: string | null | undefined, splitNumbers = true): string[][] {
  const text = normalize(description, splitNumbers);
  return text ? text.split(" ").map(tokenVariants) : [];
}

/** A keyword or phrase. A trailing "*" matches the start of a word ("print*" → printing). */
type Keyword = { tokens: string[]; prefix: boolean };

function keyword(raw: string): Keyword {
  const prefix = raw.endsWith("*");
  return { tokens: normalizeText(prefix ? raw.slice(0, -1) : raw).split(" ").filter(Boolean), prefix };
}

function matches(text: string[][], kw: Keyword): boolean {
  const n = kw.tokens.length;
  if (n === 0) return false;
  for (let i = 0; i + n <= text.length; i++) {
    let ok = true;
    for (let j = 0; j < n && ok; j++) {
      const want = kw.tokens[j];
      const byPrefix = kw.prefix && j === n - 1;
      ok = text[i + j].some((v) => (byPrefix ? v.startsWith(want) : v === want));
    }
    if (ok) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/** Canonical unit → the ways it is written (Arabic and English). Plural English forms are also accepted. */
export const UNIT_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  m2: ["m2", "m²", "sqm", "sq m", "sq.m", "sq mt", "sq meter", "sq metre", "square meter", "square metre", "م2", "م²", "متر مربع"],
  m3: ["m3", "m³", "cbm", "cu m", "cubic meter", "cubic metre", "م3", "متر مكعب"],
  m: ["m", "lm", "rm", "mtr", "meter", "metre", "linear meter", "linear metre", "running meter", "running metre", "م", "م ط", "متر", "متر طولي"],
  nos: ["nos", "no", "nr", "number", "pcs", "pc", "piece", "ea", "each", "unit", "item", "عدد", "حبة", "حبات", "قطعة", "قطع", "وحدة"],
  ls: ["ls", "l.s.", "l/s", "lump sum", "lumpsum", "lot", "job", "مقطوعية", "مقطوع"],
  day: ["day", "days", "يوم", "أيام"],
  hr: ["hr", "hrs", "hour", "hours", "ساعة", "ساعات"],
  set: ["set", "sets", "طقم", "أطقم", "مجموعة"],
  kg: ["kg", "kgs", "kilogram", "كجم", "كغ", "كيلو", "كيلوجرام"],
  person: ["person", "persons", "people", "pax", "guest", "شخص", "أشخاص", "فرد", "أفراد", "ضيف"],
  night: ["night", "ليلة", "ليال", "ليالي"],
  week: ["week", "wk", "أسبوع", "أسابيع"],
  month: ["month", "شهر", "أشهر", "شهور"],
  trip: ["trip", "رحلة", "رحلات"],
};

/** "per day", "/day" and "لكل يوم" are a day. */
const UNIT_LEADING_WORDS = new Set(["per", "لكل", "كل"]);

function unitKey(raw: string | null | undefined): string | null {
  const tokens = normalizeText(raw).split(" ").filter(Boolean);
  while (tokens.length > 1 && UNIT_LEADING_WORDS.has(tokens[0])) tokens.shift();
  return tokens.join("") || null;
}

const UNIT_INDEX = new Map<string, string>();
for (const [canonical, synonyms] of Object.entries(UNIT_SYNONYMS)) {
  for (const synonym of synonyms) {
    const key = unitKey(synonym);
    if (key) UNIT_INDEX.set(key, canonical);
  }
}

/** The canonical unit ("sqm", "م²" and "متر مربع" → "m2"), or null when the unit is empty or unknown. */
export function canonicalUnit(raw: string | null | undefined): string | null {
  const key = unitKey(raw);
  if (!key) return null;
  const direct = UNIT_INDEX.get(key);
  if (direct) return direct;
  if (/^[a-z]{4,}$/.test(key)) {
    for (const singular of latinVariants(key)) {
      const found = UNIT_INDEX.get(singular);
      if (found) return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Provisional and prime-cost sums
// ---------------------------------------------------------------------------

const PROVISIONAL_KEYWORDS = [
  "ps", "p s", "provisional", "prime cost", "pc sum", "p c sum", "contingency",
  "مبلغ احتياطي", "مبالغ احتياطية", "مبلغ تقديري", "مبالغ تقديرية",
].map(keyword);

/**
 * "احتياطي" names a reserve sum when it leads the description ("احتياطي طوارئ", "الاحتياطي العام").
 * After a noun it is an adjective, as in "مولد احتياطي" (a standby generator), which is equipment.
 */
const PROVISIONAL_LEADING = normalizeText("احتياطي");

/** Reads whole words as written, so "PS4" (a games console) is not "PS". */
function isProvisional(description: string): boolean {
  const text = words(description, false);
  if (text.length > 0 && text[0].includes(PROVISIONAL_LEADING)) return true;
  return PROVISIONAL_KEYWORDS.some((kw) => matches(text, kw));
}

// ---------------------------------------------------------------------------
// Categories (event procurement)
// ---------------------------------------------------------------------------

/**
 * Keyword dictionary, in priority order: when two categories match equally often, the earlier wins.
 * Words are written in their base form; plurals, the Arabic article and one-letter prefixes
 * (و ب ل ف ك) are handled by the matcher. A trailing "*" matches the start of a word.
 */
const CATEGORY_RULES: readonly { category: string; keywords: readonly string[] }[] = [
  {
    category: "صوت وإضاءة وشاشات",
    keywords: [
      "av", "a v", "audio*", "audiovisual", "sound", "speaker", "subwoofer", "mic", "microphone*", "mixer", "amplifier",
      "pa system", "public address", "lighting", "lights", "spotlight", "moving head", "follow spot", "led", "screen",
      "projector", "projection", "display", "video wall", "videowall", "monitor", "tv", "television", "laser", "dj",
      "صوت", "صوتي", "صوتية", "صوتيات", "سماعة", "سماعات", "مايك", "مايكروفون", "ميكروفون", "ميكسر", "إضاءة", "اضاءات",
      "إنارة", "كشاف", "كشافات", "شاشة", "شاشات", "ليد", "بروجكتر", "بروجيكتر", "جهاز عرض",
    ],
  },
  {
    category: "المسرح والإنشاءات",
    keywords: [
      "stage", "staging", "truss", "trussing", "platform", "podium", "riser", "rigging", "scaffold*",
      "construction", "fabrication", "carpentry", "joinery", "catwalk", "runway", "booth", "stand",
      "مسرح", "مسارح", "منصة", "منصات", "ستيج", "منبر", "بوديوم", "سقالة", "سقالات", "إنشاءات",
      "إنشائي", "نجارة", "أعمال خشبية",
    ],
  },
  {
    category: "الأثاث",
    keywords: [
      "chair", "table", "sofa", "couch", "furniture", "seating", "stool", "bench", "armchair", "ottoman", "pouf", "desk",
      "كرسي", "كراسي", "طاولة", "طاولات", "كنب", "كنبة", "أريكة", "أرائك", "أثاث", "مفروشات", "مقعد", "مقاعد", "جلسات",
    ],
  },
  {
    category: "الضيافة",
    keywords: [
      "catering", "cater*", "coffee", "tea", "buffet", "meal", "lunch", "dinner", "breakfast", "snack", "refreshment",
      "beverage", "drink", "water", "juice", "dessert", "canape", "food", "hospitality", "waiter*", "barista",
      "ضيافة", "قهوة", "شاي", "بوفيه", "وجبة", "وجبات", "غداء", "عشاء", "إفطار", "فطور", "سناك", "مشروب",
      "مشروبات", "مياه", "ماء", "عصير", "عصائر", "حلويات", "مقبلات", "طعام", "أطعمة", "كيترنج", "كاترينج",
    ],
  },
  {
    category: "الطباعة واللوحات",
    keywords: [
      "print*", "banner", "signage", "sign", "signboard", "wayfinding", "way finding", "rollup", "roll up", "popup",
      "pop up", "flyer", "brochure", "poster", "sticker", "vinyl", "branding", "lightbox", "badge", "invitation",
      "طباعة", "مطبوعات", "لوحة", "لوحات", "لافتة", "لافتات", "بنر", "بنرات", "إرشادي", "إرشادية", "رول أب",
      "ملصق", "ملصقات", "بوستر", "بروشور", "دعوات",
    ],
  },
  {
    category: "الطواقم",
    keywords: [
      "usher", "hostess", "host", "crew", "staff", "staffing", "manpower", "labour", "labor", "worker", "supervisor",
      "coordinator", "technician", "helper", "volunteer", "receptionist", "mc", "presenter", "promoter", "cleaner",
      "cleaning",
      "منظم", "منظمين", "منظمات", "مضيف", "مضيفين", "مضيفة", "مضيفات", "طاقم", "طواقم", "عمالة", "عمال", "موظف",
      "موظفين", "مشرف", "مشرفين", "منسق", "منسقين", "فني", "فنيين", "متطوع", "متطوعين", "عريف", "نظافة",
    ],
  },
  {
    category: "الأمن والسلامة",
    keywords: [
      "security", "guard", "bouncer", "first aid", "firstaid", "paramedic", "ambulance", "medic", "medical", "nurse",
      "safety", "fire extinguisher", "extinguisher", "fire", "barrier", "barricade", "crowd control", "metal detector",
      "cctv",
      "أمن", "أمني", "أمنية", "حراسة", "حارس", "حراس", "سلامة", "إسعاف", "إسعافات", "مسعف", "مسعفين", "طبي", "طبية",
      "إطفاء", "طفاية", "طفايات", "حواجز", "حاجز", "تفتيش", "مراقبة",
    ],
  },
  {
    category: "النقل واللوجستيات",
    keywords: [
      "bus", "coach", "van", "car", "vehicle", "transport*", "shuttle", "logistic*", "forklift", "crane", "truck",
      "lorry", "delivery", "freight", "shipping", "storage", "warehouse", "driver", "limousine", "taxi", "valet",
      "باص", "باصات", "حافلة", "حافلات", "نقل", "مواصلات", "سيارة", "سيارات", "شاحنة", "شاحنات", "رافعة", "رافعات",
      "فوركلفت", "لوجستي", "لوجستية", "لوجستيات", "توصيل", "شحن", "تخزين", "مستودع", "سائق", "سائقين", "ونش",
    ],
  },
  {
    category: "الخيام والأرضيات",
    keywords: [
      "tent", "marquee", "canopy", "gazebo", "carpet", "carpeting", "flooring", "floor", "rug", "turf", "decking",
      "shade", "umbrella",
      "خيمة", "خيام", "خيم", "مظلة", "مظلات", "سرادق", "سرادقات", "صيوان", "سجاد", "سجادة", "موكيت", "أرضيات",
      "أرضية", "باركيه", "عشب",
    ],
  },
  {
    category: "الكهرباء",
    keywords: [
      "generator", "genset", "power", "electrical", "electricity", "electric", "cable", "cabling", "kva", "kw",
      "distribution board", "socket", "diesel", "fuel", "ups",
      "مولد", "مولدات", "كهرباء", "كهربائي", "كهربائية", "كابل", "كابلات", "كيابل", "طاقة", "تمديدات", "لوحة توزيع",
      "ديزل", "وقود",
    ],
  },
  {
    category: "التصوير والبث",
    keywords: [
      "photo*", "photo booth", "video", "videography", "videographer", "film*", "camera", "streaming", "stream",
      "livestream", "broadcast*", "drone", "media coverage", "montage",
      "تصوير", "مصور", "مصورين", "فوتوغرافي", "فيديو", "بث", "كاميرا", "كاميرات", "درون", "مونتاج", "توثيق",
      "تغطية إعلامية",
    ],
  },
  {
    category: "الديكور",
    keywords: [
      "flower*", "floral", "florist", "bouquet", "decor*", "backdrop", "centerpiece", "centrepiece", "balloon*", "drape",
      "draping", "theming", "plant", "greenery", "arch", "props",
      "ورد", "ورود", "زهور", "زهر", "باقة", "باقات", "ديكور", "ديكورات", "تزيين", "زينة", "خلفية", "خلفيات", "بالون",
      "بالونات", "نباتات", "مجسمات", "ستائر",
    ],
  },
  {
    category: "التصاريح",
    keywords: [
      "permit*", "licence", "license", "licensing", "approval", "municipality", "civil defence", "civil defense", "noc",
      "تصريح", "تصاريح", "ترخيص", "تراخيص", "رخصة", "رخص", "موافقة", "موافقات", "بلدية", "دفاع مدني",
    ],
  },
];

const CATEGORY_INDEX = CATEGORY_RULES.map((rule) => ({ category: rule.category, keywords: rule.keywords.map(keyword) }));

/** The category names, in priority order. */
export const BOQ_CATEGORIES: readonly string[] = CATEGORY_RULES.map((rule) => rule.category);

function categoryOf(text: string[][]): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const rule of CATEGORY_INDEX) {
    const score = rule.keywords.reduce((n, kw) => n + (matches(text, kw) ? 1 : 0), 0);
    if (score > bestScore) {
      best = rule.category;
      bestScore = score;
    }
  }
  return best;
}

/**
 * A rule-based guess of the event procurement category of a BOQ line (for grouping RFQs), from
 * Arabic and English keywords in its description. Null when nothing matches.
 */
export function suggestCategory(description: string | null | undefined): string | null {
  return categoryOf(words(description));
}

// ---------------------------------------------------------------------------
// Messages (Arabic)
// ---------------------------------------------------------------------------

const lineList = (lines: number[]) => (lines.length === 1 ? `البند ${lines[0]}` : `البنود ${lines.join("، ")}`);
const formatQuantity = (q: number) => q.toLocaleString("en-US", { maximumFractionDigits: 2 });

const MESSAGES = {
  missingQuantity: "الكمية غير محددة.",
  missingQuantityPriced: "البند مسعّر بلا كمية: لن يدخل سعره في الإجمالي.",
  unpriced: "البند غير مسعّر بعد.",
  missingUnit: "وحدة القياس غير محددة.",
  unknownUnit: (unit: string) => `وحدة القياس «${unit}» غير معروفة: تأكد منها أو استخدم وحدة قياسية.`,
  duplicate: (related: number[]) => `الوصف نفسه مكرر في ${lineList(related)}.`,
  unitConflict: (related: number[], mine: string, others: string[]) =>
    `الوصف نفسه بوحدة قياس مختلفة في ${lineList(related)}: «${mine}» مقابل «${others.join("»، «")}».`,
  quantityConflict: (related: number[], mine: number, others: number[]) =>
    `الوصف والوحدة نفسهما بكمية مختلفة في ${lineList(related)}: ${formatQuantity(mine)} مقابل ${others.map(formatQuantity).join("، ")}.`,
  provisional: "مبلغ احتياطي أو تقديري: أكّد طريقة احتسابه مع العميل.",
  vague: "الوصف مختصر جدًا: ينقصه تفصيل المواصفات.",
  belowCost: "سعر البيع أقل من التكلفة الداخلية: البند يُباع بخسارة.",
  lowMargin: (pct: number) => `هامش الربح ${pct}% فقط، أقل من ${LOW_MARGIN_PCT}%.`,
  highMargin: (pct: number) => `هامش الربح ${pct}%، أعلى من ${HIGH_MARGIN_PCT}%: راجع السعر والتكلفة.`,
  missingCost: "البند مسعّر بلا تكلفة داخلية: لا يمكن حساب هامشه.",
};

// ---------------------------------------------------------------------------
// The checker
// ---------------------------------------------------------------------------

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const unique = <T,>(values: T[]) => [...new Set(values)];

/** Runs every check on the lines, in their given order. Never changes the input. */
export function checkBoq(lines: readonly BoqLine[], options: BoqCheckOptions): BoqCheckResult {
  const findings: Finding[] = [];
  const add = (index: number, code: FindingCode, severity: Severity, message: string, related?: number[]) => {
    findings.push({
      lineId: lines[index].id,
      line: index + 1,
      code,
      severity,
      message,
      ...(related && related.length > 0 ? { related } : {}),
    });
  };

  const prepared = lines.map((line) => {
    const text = normalizeText(line.description);
    const key = unitKey(line.unit);
    const canonical = canonicalUnit(line.unit);
    return {
      text,
      words: text ? text.split(" ").map(tokenVariants) : [],
      unitText: (line.unit ?? "").trim(),
      /** What units are compared by: the canonical unit, or the written form of an unknown one. */
      unit: key == null ? null : (canonical ?? `?${key}`),
      knownUnit: canonical != null,
      quantity: toNumber(line.quantity),
      price: toNumber(line.unit_price),
      /** undefined: no cost was given (not a finance viewer). null: given but empty. */
      cost: line.unit_cost === undefined ? undefined : toNumber(line.unit_cost),
    };
  });

  // Checks on each line by itself.
  prepared.forEach((p, i) => {
    const priced = p.price != null && p.price > 0;

    if (p.quantity == null || p.quantity === 0) {
      add(i, "missing_quantity", priced ? "critical" : "warning", priced ? MESSAGES.missingQuantityPriced : MESSAGES.missingQuantity);
    }
    if (!priced && !lines[i].is_optional) add(i, "unpriced", "warning", MESSAGES.unpriced);

    if (p.unit == null) add(i, "missing_unit", "warning", MESSAGES.missingUnit);
    else if (!p.knownUnit) add(i, "unknown_unit", "info", MESSAGES.unknownUnit(p.unitText));

    if (isProvisional(lines[i].description)) add(i, "provisional_sum", "info", MESSAGES.provisional);
    if (p.text.replace(/ /g, "").length < MIN_DESCRIPTION_CHARS) add(i, "vague_description", "info", MESSAGES.vague);

    if (options.finance && p.cost !== undefined && priced) {
      const price = p.price as number;
      if (p.cost == null || p.cost === 0) {
        add(i, "missing_cost", "info", MESSAGES.missingCost);
      } else if (price < p.cost) {
        add(i, "below_cost", "critical", MESSAGES.belowCost);
      } else {
        const pct = Math.round(((price - p.cost) / price) * 10000) / 100;
        // Shown to one decimal, rounded away from the threshold so the figure never contradicts the rule.
        if (pct < LOW_MARGIN_PCT) add(i, "low_margin", "warning", MESSAGES.lowMargin(Math.floor(pct * 10) / 10));
        else if (pct > HIGH_MARGIN_PCT) add(i, "high_margin", "info", MESSAGES.highMargin(Math.ceil(pct * 10) / 10));
      }
    }
  });

  // Lines sharing a description: duplicates, then unit and quantity conflicts within them.
  const byDescription = new Map<string, number[]>();
  prepared.forEach((p, i) => {
    if (p.text) byDescription.set(p.text, [...(byDescription.get(p.text) ?? []), i]);
  });
  const lineNumbers = (indexes: number[]) => indexes.map((i) => i + 1);

  for (const group of byDescription.values()) {
    if (group.length < 2) continue;
    for (const i of group) {
      const others = lineNumbers(group.filter((j) => j !== i));
      add(i, "duplicate", "warning", MESSAGES.duplicate(others), others);
    }

    // Lines without a unit already have their own finding, so they are not compared.
    const withUnit = group.filter((i) => prepared[i].unit != null);
    if (new Set(withUnit.map((i) => prepared[i].unit)).size > 1) {
      for (const i of withUnit) {
        const differ = withUnit.filter((j) => prepared[j].unit !== prepared[i].unit);
        add(i, "unit_conflict", "warning",
          MESSAGES.unitConflict(lineNumbers(differ), prepared[i].unitText, unique(differ.map((j) => prepared[j].unitText))),
          lineNumbers(differ));
      }
    }

    // Lines without a unit count as one unit here.
    const byUnit = new Map<string, number[]>();
    for (const i of group) {
      const unit = prepared[i].unit ?? "";
      byUnit.set(unit, [...(byUnit.get(unit) ?? []), i]);
    }
    for (const sameUnit of byUnit.values()) {
      // Missing quantities already have their own finding.
      const counted = sameUnit.filter((i) => prepared[i].quantity != null && prepared[i].quantity !== 0);
      if (new Set(counted.map((i) => prepared[i].quantity)).size < 2) continue;
      for (const i of counted) {
        const differ = counted.filter((j) => prepared[j].quantity !== prepared[i].quantity);
        add(i, "quantity_conflict", "info",
          MESSAGES.quantityConflict(lineNumbers(differ), prepared[i].quantity as number, unique(differ.map((j) => prepared[j].quantity as number))),
          lineNumbers(differ));
      }
    }
  }

  const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s);
  const order = (c: FindingCode) => CHECK_ORDER.indexOf(c);
  findings.sort((a, b) => rank(a.severity) - rank(b.severity) || order(a.code) - order(b.code) || a.line - b.line);

  const categories: BoqCategoryGroup[] = [];
  const byCategory = new Map<string, BoqCategoryGroup>();
  prepared.forEach((p, i) => {
    const category = categoryOf(p.words);
    if (!category) return;
    let group = byCategory.get(category);
    if (!group) {
      group = { category, lineIds: [] };
      byCategory.set(category, group);
      categories.push(group);
    }
    group.lineIds.push(lines[i].id);
  });

  const count = (s: Severity) => findings.filter((f) => f.severity === s).length;
  return {
    findings,
    summary: { critical: count("critical"), warning: count("warning"), info: count("info"), linesChecked: lines.length },
    categories,
  };
}
