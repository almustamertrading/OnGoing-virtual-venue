/**
 * Calendar date maths and feed helpers: pure functions (no React, no Supabase), tested in
 * calendar.test.ts.
 *
 * Two kinds of values:
 * - plain dates "YYYY-MM-DD" with no time zone: grid cells, all-day items, URL anchors.
 *   They are handled as UTC midnights internally, so no local time zone can shift them;
 * - instants (ISO timestamps): timed events, always shown in the organisation's time zone.
 *
 * Weeks start on Sunday. Text is Arabic with Gregorian months and Latin digits, assembled from
 * Intl names so the server and the browser render exactly the same string.
 */
import type { Access } from "./permissions";
import type { CalendarEventKind, CalendarFeedItem } from "./types";

export const DEFAULT_TIME_ZONE = "Asia/Riyadh";

export const CALENDAR_VIEWS = ["month", "week", "agenda"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type FeedSource = CalendarFeedItem["source"];
export const FEED_SOURCES: readonly FeedSource[] = [
  "event", "project", "submission", "milestone", "task", "phase", "proposal", "rfq", "invoice", "requirement",
];

export const EVENT_KINDS: readonly CalendarEventKind[] = [
  "meeting", "site_visit", "rehearsal", "load_in", "event_day", "deadline", "other",
];

/** 0 = Sunday. */
export const WEEK_STARTS_ON = 0;

/** Same limits as the calendar_events CHECK constraints. */
export const TITLE_MAX = 300;
export const LOCATION_MAX = 300;
export const DESCRIPTION_MAX = 4000;

/** Project filter value for organisation-wide items only. */
export const ORG_WIDE = "org";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

// ---------------------------------------------------------------------------
// Plain dates
// ---------------------------------------------------------------------------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateMs(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function dateFromMs(ms: number) {
  const dt = new Date(ms);
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** A real calendar date "YYYY-MM-DD" (years 1900 to 2200), or null. */
export function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function addDays(iso: string, days: number) {
  return dateFromMs(dateMs(iso) + days * DAY_MS);
}

/** Whole days from b to a (a - b). */
export function diffDays(a: string, b: string) {
  return Math.round((dateMs(a) - dateMs(b)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: string) {
  return new Date(dateMs(iso)).getUTCDay();
}

export function startOfWeek(iso: string, weekStartsOn = WEEK_STARTS_ON) {
  return addDays(iso, -((dayOfWeek(iso) - weekStartsOn + 7) % 7));
}

export function startOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return `${iso.slice(0, 7)}-${pad(daysInMonth(y, m))}`;
}

/** Same day of another month, clamped to that month's length (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  return `${pad(year, 4)}-${pad(month)}-${pad(Math.min(d, daysInMonth(year, month)))}`;
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

// ---------------------------------------------------------------------------
// Visible ranges
// ---------------------------------------------------------------------------

export type DateRange = { start: string; end: string };

export function monthRange(anchor: string): DateRange {
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

/** Whole weeks covering the anchor's month (4 to 6 rows), Sunday first. */
export function monthGridRange(anchor: string, weekStartsOn = WEEK_STARTS_ON): DateRange {
  const { start, end } = monthRange(anchor);
  return { start: startOfWeek(start, weekStartsOn), end: addDays(startOfWeek(end, weekStartsOn), 6) };
}

/** The month grid as rows of seven dates. */
export function monthGridWeeks(anchor: string, weekStartsOn = WEEK_STARTS_ON): string[][] {
  const { start, end } = monthGridRange(anchor, weekStartsOn);
  const weeks: string[][] = [];
  for (let w = start; w <= end; w = addDays(w, 7)) weeks.push(eachDay(w, addDays(w, 6)));
  return weeks;
}

export function weekRange(anchor: string, weekStartsOn = WEEK_STARTS_ON): DateRange {
  const start = startOfWeek(anchor, weekStartsOn);
  return { start, end: addDays(start, 6) };
}

/** The dates a view shows; also the range asked from calendar_feed. The agenda lists one month. */
export function visibleRange(view: CalendarView, anchor: string): DateRange {
  if (view === "week") return weekRange(anchor);
  if (view === "agenda") return monthRange(anchor);
  return monthGridRange(anchor);
}

/** Previous (-1) or next (+1) period of a view. */
export function shiftAnchor(view: CalendarView, anchor: string, step: number) {
  return view === "week" ? addDays(anchor, 7 * step) : addMonths(anchor, step);
}

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The organisation's zone, or Riyadh when it is missing or unknown. */
export function resolveTimeZone(timeZone: unknown): string {
  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** Wall-clock reading of an instant in a time zone. */
export function zonedParts(instant: Date | string, timeZone: string): ZonedParts {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const out: ZonedParts = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type in out) out[part.type as keyof ZonedParts] = Number(part.value);
  }
  if (out.hour === 24) out.hour = 0; // Some engines print midnight as 24.
  return out;
}

/** The calendar date of an instant in a time zone. */
export function zonedDate(instant: Date | string, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayInZone(timeZone: string, now: Date = new Date()) {
  return zonedDate(now, timeZone);
}

/** Minutes since local midnight. */
export function minutesOfDay(instant: Date | string, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  return p.hour * 60 + p.minute;
}

/** Offset of the zone from UTC at an instant, in minutes (Riyadh: +180). */
export function tzOffsetMinutes(instant: Date, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((wall - (instant.getTime() - instant.getUTCMilliseconds())) / 60_000);
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * A datetime-local value ("2027-03-10T10:00") read as wall-clock time in the zone, returned as
 * a UTC ISO timestamp for a timestamptz column. A time skipped by a daylight-saving change moves
 * forward (02:30 on a spring-forward night becomes 03:30); a repeated time takes its first occurrence.
 */
export function zonedInputToUtc(value: string, timeZone: string): string | null {
  const m = LOCAL_RE.exec(value.trim());
  if (!m || !parseIsoDate(`${m[1]}-${m[2]}-${m[3]}`)) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v ?? 0));
  if (h > 23 || mi > 59 || s > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = tzOffsetMinutes(new Date(wall), timeZone);
  let ts = wall - first * 60_000;
  const second = tzOffsetMinutes(new Date(ts), timeZone);
  if (second !== first) {
    const retry = wall - second * 60_000;
    ts = tzOffsetMinutes(new Date(retry), timeZone) === second ? retry : Math.max(ts, retry);
  }
  return new Date(ts).toISOString();
}

/** A UTC instant as a datetime-local value in the zone ("2027-03-10T10:00"). */
export function utcToZonedInput(instant: Date | string, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * When the start moves, the end moves with it so the event keeps its length. Works on dates
 * ("2027-03-10") and datetime-local values ("2027-03-10T10:00") as wall-clock values; anything
 * unreadable, or an end already before the start, is left as it was.
 */
export function moveEndWithStart(prevStart: string, prevEnd: string, nextStart: string): string {
  const read = (value: string) => {
    const date = parseIsoDate(value.slice(0, 10));
    if (!date) return null;
    if (value.length === 10) return dateMs(date);
    const time = /^T(\d{2}):(\d{2})$/.exec(value.slice(10));
    return time ? dateMs(date) + (Number(time[1]) * 60 + Number(time[2])) * 60_000 : null;
  };
  const [a, b, c] = [read(prevStart), read(prevEnd), read(nextStart)];
  if (a === null || b === null || c === null || b < a || prevEnd.length !== nextStart.length) return prevEnd;
  const end = new Date(c + (b - a));
  const date = `${pad(end.getUTCFullYear(), 4)}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`;
  return nextStart.length === 10 ? date : `${date}T${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`;
}

// ---------------------------------------------------------------------------
// Arabic formatting (Gregorian calendar, Latin digits)
// ---------------------------------------------------------------------------

const LOCALE = "ar-u-ca-gregory-nu-latn";
const names = new Map<string, string>();

function intlPart(key: string, options: Intl.DateTimeFormatOptions, utcMs: number, type: Intl.DateTimeFormatPartTypes) {
  let value = names.get(key);
  if (value === undefined) {
    const parts = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).formatToParts(new Date(utcMs));
    value = parts.find((p) => p.type === type)?.value ?? "";
    names.set(key, value);
  }
  return value;
}

/** Arabic weekday name (0 = Sunday), from Intl. */
export function weekdayName(dow: number, style: "long" | "short" | "narrow" = "long") {
  // 1 January 2023 was a Sunday.
  return intlPart(`wd:${style}:${dow}`, { weekday: style }, Date.UTC(2023, 0, 1 + dow), "weekday");
}

/** Weekday names in grid order (Sunday first). */
export function weekdayNames(style: "long" | "short" | "narrow" = "long", weekStartsOn = WEEK_STARTS_ON) {
  return Array.from({ length: 7 }, (_, i) => weekdayName((weekStartsOn + i) % 7, style));
}

/** Arabic Gregorian month name (1 = January), from Intl. */
export function monthName(month: number) {
  return intlPart(`mo:${month}`, { month: "long" }, Date.UTC(2023, month - 1, 1), "month");
}

/** "مارس 2027" */
export function formatMonthTitle(anchor: string) {
  const [y, m] = anchor.split("-").map(Number);
  return `${monthName(m)} ${y}`;
}

/** "الأربعاء، 10 مارس 2027" */
export function formatDayLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${weekdayName(dayOfWeek(iso))}، ${d} ${monthName(m)} ${y}`;
}

/** "10 مارس" */
export function formatDayShort(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${monthName(m)}`;
}

/** "14:30" in the zone (24-hour clock). */
export function formatTime(instant: Date | string, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Heading of the visible period: "مارس 2027", or for a week "28 فبراير – 6 مارس 2027". */
export function formatPeriodTitle(view: CalendarView, anchor: string) {
  if (view !== "week") return formatMonthTitle(anchor);
  const { start, end } = weekRange(anchor);
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  if (y1 !== y2) return `${d1} ${monthName(m1)} ${y1} – ${d2} ${monthName(m2)} ${y2}`;
  if (m1 !== m2) return `${d1} ${monthName(m1)} – ${d2} ${monthName(m2)} ${y2}`;
  return `${d1}–${d2} ${monthName(m2)} ${y2}`;
}

// ---------------------------------------------------------------------------
// URL state
// ---------------------------------------------------------------------------

export type CalendarFilters = {
  /** A project id, ORG_WIDE for organisation-wide items only, or null for everything. */
  project: string | null;
  /** Sources to show; empty means every source. */
  types: FeedSource[];
};

export type CalendarParams = CalendarFilters & {
  view: CalendarView;
  /** The anchor date the period is built around. */
  date: string;
  /** Whether the URL named a date (otherwise the anchor is today). */
  explicitDate: boolean;
};

type SearchParams = Record<string, string | string[] | undefined>;
const firstValue = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Known sources from a comma list, in canonical order and without duplicates. */
export function parseTypes(raw: string | null | undefined): FeedSource[] {
  if (!raw) return [];
  const wanted = new Set(raw.split(",").map((s) => s.trim()));
  return FEED_SOURCES.filter((s) => wanted.has(s));
}

/** view, date, project and types from the URL; anything invalid falls back to the default. */
export function parseCalendarParams(params: SearchParams, today: string): CalendarParams {
  const rawView = firstValue(params.view) ?? "";
  const view = (CALENDAR_VIEWS as readonly string[]).includes(rawView) ? (rawView as CalendarView) : "month";
  const date = parseIsoDate(firstValue(params.date));
  const rawProject = (firstValue(params.project) ?? "").trim().toLowerCase();
  const project = rawProject === ORG_WIDE || isUuid(rawProject) ? rawProject : null;
  return { view, date: date ?? today, explicitDate: date !== null, project, types: parseTypes(firstValue(params.types)) };
}

/** The /calendar URL of a state. Defaults are left out: "this month, everything" is plain /calendar. */
export function calendarHref(state: {
  view?: CalendarView;
  date?: string | null;
  project?: string | null;
  types?: readonly FeedSource[];
}) {
  const query: string[] = [];
  if (state.view && state.view !== "month") query.push(`view=${state.view}`);
  if (state.date && parseIsoDate(state.date)) query.push(`date=${state.date}`);
  if (state.project && (state.project === ORG_WIDE || isUuid(state.project))) query.push(`project=${state.project}`);
  const types = FEED_SOURCES.filter((s) => state.types?.includes(s));
  if (types.length && types.length < FEED_SOURCES.length) query.push(`types=${types.join(",")}`);
  return query.length ? `/calendar?${query.join("&")}` : "/calendar";
}

// ---------------------------------------------------------------------------
// Feed items
// ---------------------------------------------------------------------------

const SOURCE_ORDER = Object.fromEntries(FEED_SOURCES.map((s, i) => [s, i])) as Record<FeedSource, number>;
const instantMs = (iso: string | null) => (iso ? Date.parse(iso) : 0);

/** Chronological: by first day, all-day items before timed ones, then start time, source and title. */
export function compareFeedItems(a: CalendarFeedItem, b: CalendarFeedItem) {
  return (
    a.start_date.localeCompare(b.start_date) ||
    Number(!a.all_day) - Number(!b.all_day) ||
    instantMs(a.starts_at) - instantMs(b.starts_at) ||
    SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
    a.title.localeCompare(b.title)
  );
}

export function sortFeed(items: readonly CalendarFeedItem[]) {
  return [...items].sort(compareFeedItems);
}

export function feedItemKey(item: Pick<CalendarFeedItem, "source" | "source_id">) {
  return `${item.source}:${item.source_id}`;
}

export function filterFeed(items: readonly CalendarFeedItem[], filters: CalendarFilters) {
  return items.filter(
    (it) =>
      (filters.types.length === 0 || filters.types.includes(it.source)) &&
      (filters.project === null ||
        (filters.project === ORG_WIDE ? it.project_id === null : it.project_id === filters.project)),
  );
}

/**
 * First and last day an item occupies. A timed event that ends exactly at midnight does not
 * occupy the next day; a bad range (end before start) occupies its first day only.
 */
export function itemDays(item: CalendarFeedItem, timeZone: string): DateRange {
  let end = item.end_date < item.start_date ? item.start_date : item.end_date;
  if (
    !item.all_day && item.starts_at && item.ends_at && end > item.start_date &&
    Date.parse(item.ends_at) > Date.parse(item.starts_at) && minutesOfDay(item.ends_at, timeZone) === 0
  ) {
    end = addDays(end, -1);
  }
  return { start: item.start_date, end };
}

export type DayGroup = { date: string; items: CalendarFeedItem[] };

/** Agenda grouping: each item appears once, on its first day inside the range, in time order. */
export function groupByDay(items: readonly CalendarFeedItem[], range: DateRange, timeZone: string): DayGroup[] {
  const byDay = new Map<string, CalendarFeedItem[]>();
  for (const item of sortFeed(items)) {
    const days = itemDays(item, timeZone);
    if (days.end < range.start || days.start > range.end) continue;
    const day = days.start < range.start ? range.start : days.start;
    const list = byDay.get(day);
    if (list) list.push(item);
    else byDay.set(day, [item]);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, items: list }));
}

/** Everything that occupies a day, in time order. */
export function itemsOnDay(items: readonly CalendarFeedItem[], day: string, timeZone: string) {
  return sortFeed(items.filter((it) => {
    const d = itemDays(it, timeZone);
    return d.start <= day && day <= d.end;
  }));
}

/** Where an item is managed. Custom events have no page of their own (they open the event dialog). */
export function feedItemHref(item: CalendarFeedItem): string | null {
  const project = item.project_id;
  switch (item.source) {
    case "project":
    case "submission":
      return `/projects/${item.source_id}`;
    case "task":
    case "milestone":
      return project ? `/projects/${project}/tasks` : null;
    case "phase":
      return project ? `/projects/${project}/plan` : null;
    case "proposal":
      return `/proposals/${item.source_id}`;
    case "rfq":
      return project ? `/projects/${project}/procurement` : null;
    case "invoice":
      return project ? `/projects/${project}/finance` : null;
    case "requirement":
      return project ? `/projects/${project}/requirements` : null;
    default:
      return null;
  }
}

/** Completed work is shown faded: done tasks and milestones, paid invoices. */
export function isDone(item: CalendarFeedItem) {
  if (item.source === "task" || item.source === "milestone") return item.status === "done";
  if (item.source === "invoice") return item.status === "paid";
  if (item.source === "requirement") return item.status === "met" || item.status === "not_applicable";
  return false;
}

/** "طوال اليوم", "10:00–11:00", "10 مارس – 12 مارس" or "10 مارس 18:00 – 11 مارس 06:00". */
export function describeWhen(item: CalendarFeedItem, timeZone: string, options: { withDate?: boolean } = {}) {
  const { start, end } = itemDays(item, timeZone);
  const date = options.withDate ? `${formatDayShort(start)}، ` : "";
  if (item.all_day || !item.starts_at || !item.ends_at) {
    return start === end ? `${date}طوال اليوم` : `${formatDayShort(start)} – ${formatDayShort(end)}`;
  }
  const from = formatTime(item.starts_at, timeZone);
  const to = formatTime(item.ends_at, timeZone);
  if (start === end) return `${date}${from}–${to}`;
  return `${formatDayShort(start)} ${from} – ${formatDayShort(end)} ${to}`;
}

// ---------------------------------------------------------------------------
// Month and week layout
// ---------------------------------------------------------------------------

export type WeekSegment = {
  item: CalendarFeedItem;
  /** 0 = the week's first day (Sunday). */
  startCol: number;
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type WeekLayout = { segments: WeekSegment[]; hiddenByDay: number[]; laneCount: number };

/** Which items keep a visible lane on a busy day: custom events first, task due dates last. */
const laneRank = (item: CalendarFeedItem) => (item.source === "event" ? 0 : item.source === "task" ? 2 : 1);

/**
 * Lays out one week like a wall calendar: items sorted by first day (longer first, then custom
 * events before other dates and task due dates last) each take the first lane free across all
 * their days. Items that do not fit in maxLanes are counted per day for a "+N more" link.
 */
export function layoutWeek(
  weekStart: string,
  items: readonly CalendarFeedItem[],
  timeZone: string,
  maxLanes = Number.POSITIVE_INFINITY,
): WeekLayout {
  const weekEnd = addDays(weekStart, 6);
  const candidates = items
    .map((item) => ({ item, days: itemDays(item, timeZone) }))
    .filter(({ days }) => days.end >= weekStart && days.start <= weekEnd)
    .map(({ item, days }) => {
      const from = days.start < weekStart ? weekStart : days.start;
      const to = days.end > weekEnd ? weekEnd : days.end;
      return {
        item,
        startCol: diffDays(from, weekStart),
        span: diffDays(to, from) + 1,
        continuesBefore: days.start < weekStart,
        continuesAfter: days.end > weekEnd,
      };
    })
    .sort((a, b) =>
      a.startCol - b.startCol || b.span - a.span || laneRank(a.item) - laneRank(b.item) || compareFeedItems(a.item, b.item));

  const lanes: boolean[][] = [];
  const segments: WeekSegment[] = [];
  const hiddenByDay = [0, 0, 0, 0, 0, 0, 0];
  for (const c of candidates) {
    const cols = Array.from({ length: c.span }, (_, i) => c.startCol + i);
    let lane = lanes.findIndex((used) => cols.every((col) => !used[col]));
    if (lane === -1) lane = lanes.length;
    if (lane >= maxLanes) {
      for (const col of cols) hiddenByDay[col] += 1;
      continue;
    }
    if (lane === lanes.length) lanes.push([false, false, false, false, false, false, false]);
    for (const col of cols) lanes[lane][col] = true;
    segments.push({ ...c, lane });
  }
  return { segments, hiddenByDay, laneCount: lanes.length };
}

export type TimedBlock = {
  item: CalendarFeedItem;
  /** Minutes since local midnight. */
  start: number;
  end: number;
  /** Column among overlapping events, and how many columns the group needs. */
  col: number;
  cols: number;
};

/** Shortest block drawn in the week view, so short and zero-length events stay clickable. */
export const MIN_BLOCK_MINUTES = 30;

/** Places one day's timed events in side-by-side columns where they overlap. */
export function layoutDayEvents(items: readonly CalendarFeedItem[], timeZone: string): TimedBlock[] {
  const events = sortFeed(items.filter((it) => !it.all_day && it.starts_at && it.ends_at)).map((item) => {
    const endMinutes = minutesOfDay(item.ends_at as string, timeZone);
    const endsNextMidnight = endMinutes === 0 && Date.parse(item.ends_at as string) > Date.parse(item.starts_at as string);
    const end = Math.min(1440, Math.max(endsNextMidnight ? 1440 : endMinutes, 0));
    const start = Math.min(minutesOfDay(item.starts_at as string, timeZone), 1440 - MIN_BLOCK_MINUTES);
    return { item, start, end: Math.max(end, start + MIN_BLOCK_MINUTES) };
  });

  const blocks: TimedBlock[] = [];
  let group: TimedBlock[] = [];
  let columns: number[] = [];
  let groupEnd = Number.NEGATIVE_INFINITY;
  const closeGroup = () => {
    for (const b of group) b.cols = columns.length;
    blocks.push(...group);
    group = [];
    columns = [];
  };
  for (const e of events) {
    if (group.length && e.start >= groupEnd) closeGroup();
    let col = columns.findIndex((end) => end <= e.start);
    if (col === -1) {
      col = columns.length;
      columns.push(e.end);
    } else {
      columns[col] = e.end;
    }
    group.push({ ...e, col, cols: 1 });
    groupEnd = group.length === 1 ? e.end : Math.max(groupEnd, e.end);
  }
  if (group.length) closeGroup();
  return blocks;
}

// ---------------------------------------------------------------------------
// Overlaps (a scheduling aid, never a block)
// ---------------------------------------------------------------------------

/**
 * Whether two time ranges (epoch ms) overlap. Back-to-back ranges (10–11 and 11–12) do not;
 * a zero-length event overlaps a range it falls in, including the range's first instant.
 */
export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  if (aStart < bEnd && bStart < aEnd) return true;
  if (aStart === aEnd && bStart <= aStart && aStart < bEnd) return true;
  if (bStart === bEnd && aStart <= bStart && bStart < aEnd) return true;
  return aStart === aEnd && bStart === bEnd && aStart === bStart;
}

export type TimedEventLike = { id: string; projectId: string | null; startsAt: string; endsAt: string };
export type OverlapCandidate = { id?: string | null; projectId: string | null; startsAt: string; endsAt: string };

/**
 * Other timed events in the same scope as the candidate that overlap it. The scope is the same
 * project, or, for an organisation-wide event, the other organisation-wide events.
 */
export function overlappingEvents<T extends TimedEventLike>(candidate: OverlapCandidate, events: readonly T[]): T[] {
  const start = Date.parse(candidate.startsAt);
  const end = Date.parse(candidate.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const scope = candidate.projectId ?? null;
  return events.filter(
    (e) =>
      e.id !== candidate.id &&
      (e.projectId ?? null) === scope &&
      intervalsOverlap(start, end, Date.parse(e.startsAt), Date.parse(e.endsAt)),
  );
}

/** Overlap check against the loaded feed: timed custom events only. */
export function findOverlaps(candidate: OverlapCandidate, items: readonly CalendarFeedItem[]): CalendarFeedItem[] {
  const timed = items
    .filter((it) => it.source === "event" && !it.all_day && it.starts_at && it.ends_at)
    .map((it) => ({ id: it.source_id, projectId: it.project_id, startsAt: it.starts_at as string, endsAt: it.ends_at as string, it }));
  return sortFeed(overlappingEvents(candidate, timed).map((e) => e.it));
}

// ---------------------------------------------------------------------------
// Who may write (the database enforces the same rules in RLS)
// ---------------------------------------------------------------------------

/** private.can_contribute: admins, or members holding any working capability (not viewer-only). */
export function canContribute(access: Pick<Access, "isAdmin" | "projectManager" | "sales" | "operations" | "finance">) {
  return access.isAdmin || access.projectManager || access.sales || access.operations || access.finance;
}

/** private.can_edit: project owners and editors; organisation admins edit every project. */
export function editableProjectIds(
  projects: readonly { id: string }[],
  memberships: readonly { project_id: string; role: string }[],
  isAdmin: boolean,
): string[] {
  if (isAdmin) return projects.map((p) => p.id);
  const editable = new Set(memberships.filter((m) => m.role === "owner" || m.role === "editor").map((m) => m.project_id));
  return projects.filter((p) => editable.has(p.id)).map((p) => p.id);
}

// ---------------------------------------------------------------------------
// Event form
// ---------------------------------------------------------------------------

export type EventInput = {
  title: string;
  kind: CalendarEventKind;
  projectId: string | null;
  allDay: boolean;
  startsAt: string;
  endsAt: string;
  location: string;
  description: string;
};

export type EventFormFields = Partial<Record<
  "title" | "kind" | "project_id" | "all_day" | "start" | "end" | "location" | "description",
  string
>>;

/** Characters as Postgres char_length counts them (code points). */
const charLength = (s: string) => Array.from(s).length;

/**
 * Validates the event dialog's fields. Timed events: start and end are datetime-local values in
 * the organisation's zone. All-day events: dates, stored from 00:00 on the first day to 23:59:59
 * on the last day in that zone (calendar_feed derives the dates from these instants).
 */
export function parseEventForm(fields: EventFormFields, timeZone: string): { ok: true; value: EventInput } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  const title = (fields.title ?? "").trim();
  if (!title) return fail("اكتب عنوان الحدث.");
  if (charLength(title) > TITLE_MAX) return fail(`العنوان أطول من ${TITLE_MAX} حرف.`);

  const kind = (fields.kind || "meeting") as CalendarEventKind;
  if (!EVENT_KINDS.includes(kind)) return fail("نوع الحدث غير معروف.");

  const project = (fields.project_id ?? "").trim().toLowerCase();
  if (project && !isUuid(project)) return fail("المشروع المختار غير صالح.");

  const allDay = fields.all_day === "on" || fields.all_day === "true";
  let startsAt: string | null;
  let endsAt: string | null;
  if (allDay) {
    const startDate = parseIsoDate(fields.start);
    const endDate = fields.end?.trim() ? parseIsoDate(fields.end) : startDate;
    if (!startDate || !endDate) return fail("اختر تاريخي البداية والنهاية.");
    if (endDate < startDate) return fail("يجب ألا تسبق النهاية البداية.");
    startsAt = zonedInputToUtc(`${startDate}T00:00`, timeZone);
    endsAt = zonedInputToUtc(`${endDate}T23:59:59`, timeZone);
  } else {
    startsAt = zonedInputToUtc(fields.start ?? "", timeZone);
    endsAt = zonedInputToUtc(fields.end ?? "", timeZone);
    if (!startsAt || !endsAt) return fail("اختر وقتي البداية والنهاية.");
    if (Date.parse(endsAt) < Date.parse(startsAt)) return fail("يجب ألا تسبق النهاية البداية.");
  }
  if (!startsAt || !endsAt) return fail("اختر وقتي البداية والنهاية.");

  const location = (fields.location ?? "").trim();
  if (charLength(location) > LOCATION_MAX) return fail(`الموقع أطول من ${LOCATION_MAX} حرف.`);
  const description = (fields.description ?? "").trim();
  if (charLength(description) > DESCRIPTION_MAX) return fail(`الوصف أطول من ${DESCRIPTION_MAX} حرف.`);

  return {
    ok: true,
    value: { title, kind, projectId: project || null, allDay, startsAt, endsAt, location, description },
  };
}
