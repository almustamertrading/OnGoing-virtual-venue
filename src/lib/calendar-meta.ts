import type { FeedSource } from "./calendar";
import type { CalendarEventKind, CalendarFeedItem } from "./types";

/** Arabic labels of the custom event kinds (public.calendar_event_kind). */
export const EVENT_KIND_LABEL: Record<CalendarEventKind, string> = {
  meeting: "اجتماع",
  site_visit: "زيارة موقع",
  rehearsal: "بروفة",
  load_in: "تحميل وتركيب",
  event_day: "يوم الفعالية",
  deadline: "موعد نهائي",
  other: "أخرى",
};

/** What each feed source is, for one item. */
export const SOURCE_LABEL: Record<FeedSource, string> = {
  event: "حدث",
  project: "فترة المشروع",
  submission: "آخر موعد لتقديم المنافسة",
  milestone: "محطة رئيسية",
  task: "مهمة",
  phase: "مرحلة من الخطة",
  proposal: "آخر موعد للعرض",
  rfq: "آخر موعد لطلب التسعير",
  invoice: "استحقاق فاتورة",
};

/** Plural labels for the source filter. */
export const SOURCE_FILTER_LABEL: Record<FeedSource, string> = {
  event: "الأحداث",
  project: "المشاريع",
  submission: "مواعيد التقديم",
  milestone: "المحطات",
  task: "المهام",
  phase: "مراحل الخطة",
  proposal: "العروض",
  rfq: "طلبات التسعير",
  invoice: "الفواتير",
};

export type Swatch = {
  /** Classes for an item chip. */
  chip: string;
  /** Classes for the small colour mark in legends and lists. */
  dot: string;
};

// Custom events are filled chips coloured by kind; items from other modules are outlined chips
// (a coloured edge on the start side) coloured by source, so the two families stay apart.
export const KIND_STYLE: Record<CalendarEventKind, Swatch> = {
  meeting: { chip: "bg-sky-500/30 text-sky-50 hover:bg-sky-500/45", dot: "bg-sky-400" },
  site_visit: { chip: "bg-teal-500/30 text-teal-50 hover:bg-teal-500/45", dot: "bg-teal-400" },
  rehearsal: { chip: "bg-violet-500/30 text-violet-50 hover:bg-violet-500/45", dot: "bg-violet-400" },
  load_in: { chip: "bg-orange-500/30 text-orange-50 hover:bg-orange-500/45", dot: "bg-orange-400" },
  event_day: { chip: "bg-rose-500/30 text-rose-50 hover:bg-rose-500/45", dot: "bg-rose-400" },
  deadline: { chip: "bg-red-500/30 text-red-50 hover:bg-red-500/45", dot: "bg-red-400" },
  other: { chip: "bg-slate-500/30 text-slate-50 hover:bg-slate-500/45", dot: "bg-slate-400" },
};

export const SOURCE_STYLE: Record<Exclude<FeedSource, "event">, Swatch> = {
  project: { chip: "border-s-4 border-emerald-500 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20", dot: "bg-emerald-500" },
  submission: { chip: "border-s-4 border-yellow-400 bg-yellow-400/10 text-yellow-100 hover:bg-yellow-400/20", dot: "bg-yellow-400" },
  milestone: { chip: "border-s-4 border-amber-500 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20", dot: "bg-amber-500" },
  task: { chip: "border-s-4 border-blue-500 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20", dot: "bg-blue-500" },
  phase: { chip: "border-s-4 border-indigo-400 bg-indigo-400/10 text-indigo-100 hover:bg-indigo-400/20", dot: "bg-indigo-400" },
  proposal: { chip: "border-s-4 border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20", dot: "bg-fuchsia-500" },
  rfq: { chip: "border-s-4 border-cyan-400 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20", dot: "bg-cyan-400" },
  invoice: { chip: "border-s-4 border-lime-400 bg-lime-400/10 text-lime-100 hover:bg-lime-400/20", dot: "bg-lime-400" },
};

const isKind = (k: string): k is CalendarEventKind => k in EVENT_KIND_LABEL;

export function itemStyle(item: CalendarFeedItem): Swatch {
  if (item.source === "event") return KIND_STYLE[isKind(item.kind) ? item.kind : "other"];
  return SOURCE_STYLE[item.source];
}

/** "اجتماع" for a custom meeting, "مهمة" for a task… */
export function itemTypeLabel(item: CalendarFeedItem): string {
  if (item.source === "event") return EVENT_KIND_LABEL[isKind(item.kind) ? item.kind : "other"];
  return SOURCE_LABEL[item.source];
}
