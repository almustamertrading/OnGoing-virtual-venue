import type { LayoutItemKind } from "./types";

export type AssetDef = {
  kind: LayoutItemKind;
  label: string;
  shape: "circle" | "rect";
  w: number;
  h: number;
  color: string;
};

// The asset palette: what you can drop onto a floor plan, with sensible default
// sizes (in background pixels) and category colours.
export const LAYOUT_ASSETS: AssetDef[] = [
  { kind: "table_round", label: "طاولة دائرية", shape: "circle", w: 64, h: 64, color: "#10b981" },
  { kind: "table_rect", label: "طاولة مستطيلة", shape: "rect", w: 96, h: 48, color: "#10b981" },
  { kind: "chair", label: "كرسي", shape: "rect", w: 22, h: 22, color: "#64748b" },
  { kind: "stage", label: "مسرح", shape: "rect", w: 200, h: 90, color: "#a855f7" },
  { kind: "bar", label: "بار / ضيافة", shape: "rect", w: 120, h: 40, color: "#f59e0b" },
  { kind: "av", label: "صوت وإضاءة (AVL)", shape: "rect", w: 60, h: 60, color: "#3b82f6" },
  { kind: "entrance", label: "مدخل", shape: "rect", w: 72, h: 28, color: "#22c55e" },
  { kind: "exit", label: "مخرج طوارئ", shape: "rect", w: 72, h: 28, color: "#ef4444" },
  { kind: "vip", label: "منطقة VIP", shape: "rect", w: 140, h: 100, color: "#eab308" },
  { kind: "booth", label: "جناح / بوث", shape: "rect", w: 90, h: 90, color: "#06b6d4" },
  { kind: "text", label: "نص / ملاحظة", shape: "rect", w: 120, h: 30, color: "#e2e8f0" },
];

export const ASSET_BY_KIND: Record<LayoutItemKind, AssetDef> = Object.fromEntries(
  LAYOUT_ASSETS.map((a) => [a.kind, a]),
) as Record<LayoutItemKind, AssetDef>;
