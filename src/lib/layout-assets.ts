// GoodEvent-grade asset library for the Layout editor: a categorised palette,
// seating generators, and starter templates. Coordinates/sizes are in background
// pixels; a per-layout scale (m per px) turns them into real-world metres.

export type AssetCategory = "seating" | "stage" | "fnb" | "technical" | "access" | "structure" | "decor" | "zone";

export type LayoutItemKind =
  | "table_round" | "table_rect" | "table_long" | "chair" | "sofa"
  | "stage" | "dancefloor" | "catwalk" | "podium"
  | "bar" | "buffet" | "catering" | "coffee"
  | "av" | "screen" | "truss" | "speaker" | "dj"
  | "entrance" | "exit" | "barrier" | "restroom"
  | "tent" | "booth" | "pavilion"
  | "tree" | "planter" | "carpet" | "photobooth"
  | "zone" | "text";

export type AssetDef = {
  kind: LayoutItemKind;
  label: string;
  category: AssetCategory;
  shape: "circle" | "rect";
  w: number;
  h: number;
  color: string;
};

export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  seating: "الجلوس",
  stage: "المسرح والعرض",
  fnb: "الضيافة",
  technical: "التقني (AVL)",
  access: "الدخول والسلامة",
  structure: "الهياكل",
  decor: "الديكور",
  zone: "مناطق ونصوص",
};

export const CATEGORY_ORDER: AssetCategory[] = [
  "seating", "stage", "fnb", "technical", "access", "structure", "decor", "zone",
];

export const LAYOUT_ASSETS: AssetDef[] = [
  // Seating
  { kind: "table_round", label: "طاولة دائرية", category: "seating", shape: "circle", w: 64, h: 64, color: "#10b981" },
  { kind: "table_rect", label: "طاولة مستطيلة", category: "seating", shape: "rect", w: 96, h: 48, color: "#10b981" },
  { kind: "table_long", label: "طاولة بانكيت", category: "seating", shape: "rect", w: 160, h: 44, color: "#10b981" },
  { kind: "chair", label: "كرسي", category: "seating", shape: "rect", w: 22, h: 22, color: "#64748b" },
  { kind: "sofa", label: "كنب/جلسة", category: "seating", shape: "rect", w: 90, h: 36, color: "#84cc16" },
  // Stage & show
  { kind: "stage", label: "مسرح", category: "stage", shape: "rect", w: 200, h: 90, color: "#a855f7" },
  { kind: "dancefloor", label: "حلبة رقص", category: "stage", shape: "rect", w: 140, h: 140, color: "#c084fc" },
  { kind: "catwalk", label: "ممر عرض", category: "stage", shape: "rect", w: 220, h: 50, color: "#a855f7" },
  { kind: "podium", label: "منصة/بوديوم", category: "stage", shape: "rect", w: 50, h: 40, color: "#9333ea" },
  // F&B
  { kind: "bar", label: "بار", category: "fnb", shape: "rect", w: 120, h: 40, color: "#f59e0b" },
  { kind: "buffet", label: "بوفيه", category: "fnb", shape: "rect", w: 150, h: 46, color: "#f59e0b" },
  { kind: "catering", label: "ضيافة/مطبخ", category: "fnb", shape: "rect", w: 90, h: 70, color: "#d97706" },
  { kind: "coffee", label: "ركن قهوة", category: "fnb", shape: "rect", w: 70, h: 50, color: "#b45309" },
  // Technical
  { kind: "av", label: "صوت وإضاءة (AVL)", category: "technical", shape: "rect", w: 60, h: 60, color: "#3b82f6" },
  { kind: "screen", label: "شاشة LED", category: "technical", shape: "rect", w: 160, h: 24, color: "#2563eb" },
  { kind: "truss", label: "تراس/هيكل", category: "technical", shape: "rect", w: 180, h: 18, color: "#1d4ed8" },
  { kind: "speaker", label: "سماعة", category: "technical", shape: "rect", w: 28, h: 40, color: "#3b82f6" },
  { kind: "dj", label: "ديجي/تحكم", category: "technical", shape: "rect", w: 80, h: 50, color: "#6366f1" },
  // Access & safety
  { kind: "entrance", label: "مدخل", category: "access", shape: "rect", w: 72, h: 28, color: "#22c55e" },
  { kind: "exit", label: "مخرج طوارئ", category: "access", shape: "rect", w: 72, h: 28, color: "#ef4444" },
  { kind: "barrier", label: "حواجز", category: "access", shape: "rect", w: 120, h: 14, color: "#f97316" },
  { kind: "restroom", label: "دورات مياه", category: "access", shape: "rect", w: 80, h: 60, color: "#14b8a6" },
  // Structures
  { kind: "tent", label: "خيمة/ماركيز", category: "structure", shape: "rect", w: 180, h: 180, color: "#06b6d4" },
  { kind: "booth", label: "جناح/بوث", category: "structure", shape: "rect", w: 90, h: 90, color: "#0891b2" },
  { kind: "pavilion", label: "بافيليون", category: "structure", shape: "rect", w: 140, h: 100, color: "#0e7490" },
  // Decor
  { kind: "tree", label: "شجرة/نبات", category: "decor", shape: "circle", w: 44, h: 44, color: "#16a34a" },
  { kind: "planter", label: "حوض زرع", category: "decor", shape: "rect", w: 50, h: 50, color: "#15803d" },
  { kind: "carpet", label: "سجادة", category: "decor", shape: "rect", w: 120, h: 80, color: "#2dd4bf" },
  { kind: "photobooth", label: "ركن تصوير", category: "decor", shape: "rect", w: 70, h: 70, color: "#5eead4" },
  // Zones & text
  { kind: "zone", label: "منطقة", category: "zone", shape: "rect", w: 220, h: 160, color: "#38bdf8" },
  { kind: "text", label: "نص / ملاحظة", category: "zone", shape: "rect", w: 120, h: 30, color: "#e2e8f0" },
];

export const ASSET_BY_KIND: Record<string, AssetDef> = Object.fromEntries(
  LAYOUT_ASSETS.map((a) => [a.kind, a]),
);

export const DEFAULT_ASSET: AssetDef = ASSET_BY_KIND.table_round;

export function assetOf(kind: string): AssetDef {
  return ASSET_BY_KIND[kind] ?? DEFAULT_ASSET;
}

// Items with these kinds count as "tables" and "seats" for the live tally.
export const TABLE_KINDS = new Set(["table_round", "table_rect", "table_long"]);
export const SEAT_KINDS = new Set(["chair"]);

export type DraftItem = {
  kind: LayoutItemKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
};

const seat = (x: number, y: number, rotation = 0): DraftItem => ({
  kind: "chair", label: "", x: Math.round(x), y: Math.round(y), w: 22, h: 22, rotation, color: "#64748b",
});

/** A round table ringed by `seats` chairs, centred on (cx, cy). */
export function roundTableWithSeats(cx: number, cy: number, seats: number, tableLabel: string): DraftItem[] {
  const d = 70;
  const ring = d / 2 + 20;
  const items: DraftItem[] = [
    { kind: "table_round", label: tableLabel, x: Math.round(cx - d / 2), y: Math.round(cy - d / 2), w: d, h: d, rotation: 0, color: "#10b981" },
  ];
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
    items.push(seat(cx + Math.cos(a) * ring - 11, cy + Math.sin(a) * ring - 11, (a * 180) / Math.PI + 90));
  }
  return items;
}

/** A straight ceremony row of `count` chairs starting at (x, y). */
export function ceremonyRow(x: number, y: number, count: number): DraftItem[] {
  const gap = 28;
  return Array.from({ length: count }, (_, i) => seat(x + i * gap, y));
}

export type LayoutTemplate = { id: string; name: string; build: () => DraftItem[] };

// Starter templates (built around a ~1200×800 background).
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "wedding",
    name: "حفل زفاف",
    build: () => {
      const items: DraftItem[] = [
        { kind: "stage", label: "الكوشة", x: 500, y: 70, w: 220, h: 96, rotation: 0, color: "#a855f7" },
        { kind: "dancefloor", label: "حلبة الرقص", x: 540, y: 300, w: 160, h: 140, rotation: 0, color: "#c084fc" },
        { kind: "entrance", label: "المدخل", x: 560, y: 740, w: 90, h: 28, rotation: 0, color: "#22c55e" },
      ];
      const cols = [230, 420, 800, 990];
      const rows = [300, 470];
      let n = 1;
      for (const y of rows) for (const x of cols) items.push(...roundTableWithSeats(x, y, 8, String(n++)));
      return items;
    },
  },
  {
    id: "conference",
    name: "مؤتمر (صفوف)",
    build: () => {
      const items: DraftItem[] = [
        { kind: "stage", label: "المنصة", x: 480, y: 70, w: 260, h: 90, rotation: 0, color: "#a855f7" },
        { kind: "screen", label: "شاشة", x: 520, y: 180, w: 180, h: 24, rotation: 0, color: "#2563eb" },
      ];
      for (let r = 0; r < 6; r++) {
        items.push(...ceremonyRow(300, 300 + r * 55, 16));
      }
      return items;
    },
  },
  {
    id: "expo",
    name: "معرض (أجنحة)",
    build: () => {
      const items: DraftItem[] = [
        { kind: "entrance", label: "الدخول", x: 560, y: 740, w: 90, h: 28, rotation: 0, color: "#22c55e" },
      ];
      const xs = [220, 400, 580, 760, 940];
      const ys = [240, 420, 600];
      let n = 1;
      for (const y of ys) for (const x of xs) {
        items.push({ kind: "booth", label: `A${n++}`, x, y, w: 90, h: 90, rotation: 0, color: "#0891b2" });
      }
      return items;
    },
  },
];
