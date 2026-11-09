import { describe, expect, it } from "vitest";
import { accessFor } from "./permissions";
import type { CalendarFeedItem } from "./types";
import {
  addDays,
  addMonths,
  calendarHref,
  canContribute,
  dayOfWeek,
  describeWhen,
  editableProjectIds,
  feedItemHref,
  filterFeed,
  findOverlaps,
  formatDayLong,
  formatMonthTitle,
  formatPeriodTitle,
  groupByDay,
  intervalsOverlap,
  isDone,
  itemDays,
  itemsOnDay,
  layoutDayEvents,
  layoutWeek,
  monthGridRange,
  monthGridWeeks,
  moveEndWithStart,
  overlappingEvents,
  parseCalendarParams,
  parseEventForm,
  parseIsoDate,
  resolveTimeZone,
  shiftAnchor,
  todayInZone,
  tzOffsetMinutes,
  utcToZonedInput,
  visibleRange,
  weekRange,
  weekdayNames,
  zonedInputToUtc,
} from "./calendar";

const RIYADH = "Asia/Riyadh";
const NEW_YORK = "America/New_York";
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

/** A feed row with sensible defaults (an all-day task on 10 March 2027). */
function feed(over: Partial<CalendarFeedItem>): CalendarFeedItem {
  return {
    source: "task",
    source_id: crypto.randomUUID(),
    project_id: P1,
    label: "ONG-1",
    title: "Item",
    all_day: true,
    start_date: "2027-03-10",
    end_date: "2027-03-10",
    starts_at: null,
    ends_at: null,
    kind: "task",
    status: null,
    ...over,
  };
}

/** A timed custom event in Riyadh (UTC+3), times as local "HH:MM". */
function timed(id: string, day: string, from: string, to: string, projectId: string | null = P1, toDay = day): CalendarFeedItem {
  return feed({
    source: "event",
    source_id: id,
    project_id: projectId,
    title: id,
    all_day: false,
    kind: "meeting",
    start_date: day,
    end_date: toDay,
    starts_at: zonedInputToUtc(`${day}T${from}`, RIYADH),
    ends_at: zonedInputToUtc(`${toDay}T${to}`, RIYADH),
  });
}

describe("plain dates", () => {
  it("validates real calendar dates only", () => {
    expect(parseIsoDate("2027-03-10")).toBe("2027-03-10");
    expect(parseIsoDate("2028-02-29")).toBe("2028-02-29");
    expect(parseIsoDate("2027-02-29")).toBeNull();
    expect(parseIsoDate("2027-13-01")).toBeNull();
    expect(parseIsoDate("2027-3-1")).toBeNull();
    expect(parseIsoDate("1500-01-01")).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseIsoDate(["2027-03-10"])).toBeNull();
  });

  it("adds days and months across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2027-01-15", -1)).toBe("2026-12-15");
    expect(addMonths("2027-03-31", -13)).toBe("2026-02-28");
  });

  it("knows the weekday (0 = Sunday)", () => {
    expect(dayOfWeek("2027-03-07")).toBe(0);
    expect(dayOfWeek("2027-01-01")).toBe(5);
  });
});

describe("visible ranges", () => {
  it("builds a Sunday-first month grid", () => {
    // March 2027 starts on a Monday and ends on a Wednesday.
    expect(monthGridRange("2027-03-15")).toEqual({ start: "2027-02-28", end: "2027-04-03" });
    const weeks = monthGridWeeks("2027-03-15");
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7 && dayOfWeek(w[0]) === 0)).toBe(true);
  });

  it("crosses the year boundary", () => {
    // December 2026: Tuesday 1st to Thursday 31st.
    expect(monthGridRange("2026-12-10")).toEqual({ start: "2026-11-29", end: "2027-01-02" });
    // January 2027: Friday 1st to Sunday 31st, six rows.
    expect(monthGridRange("2027-01-20")).toEqual({ start: "2026-12-27", end: "2027-02-06" });
    expect(monthGridWeeks("2027-01-20")).toHaveLength(6);
  });

  it("can need only four rows", () => {
    // February 2026 starts on a Sunday and has 28 days.
    expect(monthGridWeeks("2026-02-01")).toHaveLength(4);
  });

  it("builds the month grid for a given time zone's today", () => {
    // 31 Dec 2026 22:30 UTC is already 1 Jan 2027 in Riyadh, still 31 Dec in New York.
    const now = new Date("2026-12-31T22:30:00Z");
    const riyadh = parseCalendarParams({}, todayInZone(RIYADH, now));
    expect(riyadh.date).toBe("2027-01-01");
    expect(visibleRange(riyadh.view, riyadh.date)).toEqual({ start: "2026-12-27", end: "2027-02-06" });
    const ny = parseCalendarParams({}, todayInZone(NEW_YORK, now));
    expect(ny.date).toBe("2026-12-31");
    expect(visibleRange(ny.view, ny.date)).toEqual({ start: "2026-11-29", end: "2027-01-02" });
  });

  it("builds week ranges (Sunday to Saturday)", () => {
    expect(weekRange("2027-01-01")).toEqual({ start: "2026-12-27", end: "2027-01-02" });
    expect(weekRange("2027-03-07")).toEqual({ start: "2027-03-07", end: "2027-03-13" });
    expect(visibleRange("week", "2027-03-13")).toEqual({ start: "2027-03-07", end: "2027-03-13" });
  });

  it("lists one month in the agenda", () => {
    expect(visibleRange("agenda", "2028-02-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("moves to the previous and next period", () => {
    expect(shiftAnchor("month", "2026-12-31", 1)).toBe("2027-01-31");
    expect(shiftAnchor("month", "2027-01-31", 1)).toBe("2027-02-28");
    expect(shiftAnchor("agenda", "2027-01-10", -1)).toBe("2026-12-10");
    expect(shiftAnchor("week", "2026-12-30", 1)).toBe("2027-01-06");
  });
});

describe("time zones and datetime-local values", () => {
  it("falls back to Riyadh for a missing or unknown zone", () => {
    expect(resolveTimeZone("Europe/London")).toBe("Europe/London");
    expect(resolveTimeZone("Mars/Olympus")).toBe(RIYADH);
    expect(resolveTimeZone(null)).toBe(RIYADH);
  });

  it("converts a datetime-local value in Riyadh to a UTC timestamp and back", () => {
    expect(zonedInputToUtc("2027-03-10T10:00", RIYADH)).toBe("2027-03-10T07:00:00.000Z");
    expect(utcToZonedInput("2027-03-10T07:00:00+00:00", RIYADH)).toBe("2027-03-10T10:00");
    // Early morning in Riyadh is the previous day (and year) in UTC.
    expect(zonedInputToUtc("2027-01-01T01:30", RIYADH)).toBe("2026-12-31T22:30:00.000Z");
    expect(utcToZonedInput("2026-12-31T22:30:00Z", RIYADH)).toBe("2027-01-01T01:30");
  });

  it("handles half-hour offsets and daylight saving time", () => {
    expect(zonedInputToUtc("2027-03-10T10:00", "Asia/Kolkata")).toBe("2027-03-10T04:30:00.000Z");
    expect(zonedInputToUtc("2027-01-15T09:00", NEW_YORK)).toBe("2027-01-15T14:00:00.000Z"); // EST
    expect(zonedInputToUtc("2027-07-15T09:00", NEW_YORK)).toBe("2027-07-15T13:00:00.000Z"); // EDT
    // 14 March 2027: 02:00 jumps to 03:00 in New York.
    expect(zonedInputToUtc("2027-03-14T03:30", NEW_YORK)).toBe("2027-03-14T07:30:00.000Z");
    expect(zonedInputToUtc("2027-03-14T02:30", NEW_YORK)).toBe("2027-03-14T07:30:00.000Z");
    expect(zonedInputToUtc("2027-03-14T01:30", NEW_YORK)).toBe("2027-03-14T06:30:00.000Z");
    expect(tzOffsetMinutes(new Date("2027-07-01T00:00:00Z"), NEW_YORK)).toBe(-240);
    expect(tzOffsetMinutes(new Date("2027-07-01T00:00:00Z"), RIYADH)).toBe(180);
  });

  it("round-trips every hour of a day", () => {
    for (let h = 0; h < 24; h++) {
      const value = `2027-11-07T${String(h).padStart(2, "0")}:15`;
      for (const zone of [RIYADH, "Europe/London", "Asia/Kolkata"]) {
        expect(utcToZonedInput(zonedInputToUtc(value, zone) as string, zone)).toBe(value);
      }
    }
  });

  it("moves the end with the start, keeping the event's length", () => {
    expect(moveEndWithStart("2027-03-01T09:00", "2027-03-01T10:30", "2027-03-17T14:00")).toBe("2027-03-17T15:30");
    expect(moveEndWithStart("2027-03-01T23:00", "2027-03-02T01:00", "2027-12-31T23:30")).toBe("2028-01-01T01:30");
    expect(moveEndWithStart("2027-03-10", "2027-03-12", "2027-12-30")).toBe("2028-01-01");
    // Nothing sensible to keep: the end stays as typed.
    expect(moveEndWithStart("2027-03-10T09:00", "", "2027-03-11T09:00")).toBe("");
    expect(moveEndWithStart("2027-03-10T09:00", "2027-03-09T09:00", "2027-03-11T09:00")).toBe("2027-03-09T09:00");
    expect(moveEndWithStart("2027-03-10T09:00", "2027-03-10T10:00", "")).toBe("2027-03-10T10:00");
  });

  it("rejects malformed values", () => {
    expect(zonedInputToUtc("2027-03-10", RIYADH)).toBeNull();
    expect(zonedInputToUtc("2027-02-30T10:00", RIYADH)).toBeNull();
    expect(zonedInputToUtc("2027-03-10T24:00", RIYADH)).toBeNull();
    expect(zonedInputToUtc("not a date", RIYADH)).toBeNull();
  });

  it("knows today in a zone", () => {
    expect(todayInZone(RIYADH, new Date("2027-03-09T21:00:00Z"))).toBe("2027-03-10");
    expect(todayInZone("UTC", new Date("2027-03-09T21:00:00Z"))).toBe("2027-03-09");
  });
});

describe("Arabic labels", () => {
  it("names weekdays Sunday first and months in Gregorian Arabic", () => {
    expect(weekdayNames()).toEqual(["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]);
    expect(formatMonthTitle("2027-03-15")).toBe("مارس 2027");
    expect(formatDayLong("2027-03-10")).toBe("الأربعاء، 10 مارس 2027");
  });

  it("titles a week that spans two months or two years", () => {
    expect(formatPeriodTitle("week", "2027-03-10")).toBe("7–13 مارس 2027");
    expect(formatPeriodTitle("week", "2027-03-02")).toBe("28 فبراير – 6 مارس 2027");
    expect(formatPeriodTitle("week", "2027-01-01")).toBe("27 ديسمبر 2026 – 2 يناير 2027");
    expect(formatPeriodTitle("month", "2027-01-01")).toBe("يناير 2027");
  });

  it("describes when an item happens", () => {
    expect(describeWhen(feed({}), RIYADH)).toBe("طوال اليوم");
    expect(describeWhen(feed({}), RIYADH, { withDate: true })).toBe("10 مارس، طوال اليوم");
    expect(describeWhen(feed({ end_date: "2027-03-12" }), RIYADH)).toBe("10 مارس – 12 مارس");
    expect(describeWhen(timed("a", "2027-03-10", "10:00", "11:30"), RIYADH)).toBe("10:00–11:30");
    expect(describeWhen(timed("b", "2027-03-10", "18:00", "06:00", P1, "2027-03-11"), RIYADH)).toBe("10 مارس 18:00 – 11 مارس 06:00");
  });
});

describe("URL state", () => {
  const today = "2026-11-09";

  it("defaults to this month's grid and every source", () => {
    expect(parseCalendarParams({}, today)).toEqual({
      view: "month", date: today, explicitDate: false, project: null, types: [],
    });
  });

  it("reads view, date, project and types, ignoring invalid values", () => {
    expect(parseCalendarParams({ view: "week", date: "2027-03-10", project: P1.toUpperCase(), types: "task,bogus,event,task" }, today))
      .toEqual({ view: "week", date: "2027-03-10", explicitDate: true, project: P1, types: ["event", "task"] });
    expect(parseCalendarParams({ view: "year", date: "2027-02-30", project: "x;drop", types: "" }, today))
      .toEqual({ view: "month", date: today, explicitDate: false, project: null, types: [] });
    expect(parseCalendarParams({ project: "org", view: ["agenda", "week"] }, today).project).toBe("org");
    expect(parseCalendarParams({ view: ["agenda", "week"] }, today).view).toBe("agenda");
  });

  it("builds URLs without defaults", () => {
    expect(calendarHref({})).toBe("/calendar");
    expect(calendarHref({ view: "month", date: null })).toBe("/calendar");
    expect(calendarHref({ view: "week", date: "2027-03-10", project: P1, types: ["task", "event"] }))
      .toBe(`/calendar?view=week&date=2027-03-10&project=${P1}&types=event,task`);
    // Every source selected is the same as no filter; invalid values never reach the URL.
    expect(calendarHref({ types: ["event", "project", "submission", "milestone", "task", "phase", "proposal", "rfq", "invoice"] })).toBe("/calendar");
    expect(calendarHref({ date: "2027-02-30", project: "javascript:alert(1)" })).toBe("/calendar");
  });
});

describe("feed items", () => {
  it("links each item to its source", () => {
    expect(feedItemHref(feed({ source: "project", source_id: P1 }))).toBe(`/projects/${P1}`);
    expect(feedItemHref(feed({ source: "submission", source_id: P1 }))).toBe(`/projects/${P1}`);
    expect(feedItemHref(feed({ source: "task" }))).toBe(`/projects/${P1}/tasks`);
    expect(feedItemHref(feed({ source: "milestone" }))).toBe(`/projects/${P1}/tasks`);
    expect(feedItemHref(feed({ source: "phase" }))).toBe(`/projects/${P1}/plan`);
    expect(feedItemHref(feed({ source: "proposal", source_id: P2, project_id: null }))).toBe(`/proposals/${P2}`);
    expect(feedItemHref(feed({ source: "rfq" }))).toBe(`/projects/${P1}/procurement`);
    expect(feedItemHref(feed({ source: "invoice" }))).toBe(`/projects/${P1}/finance`);
    expect(feedItemHref(feed({ source: "event" }))).toBeNull();
  });

  it("filters by project (or organisation-wide) and by source", () => {
    const items = [
      feed({ source: "task", project_id: P1 }),
      feed({ source: "event", project_id: null }),
      feed({ source: "invoice", project_id: P2 }),
    ];
    expect(filterFeed(items, { project: null, types: [] })).toHaveLength(3);
    expect(filterFeed(items, { project: P1, types: [] }).map((i) => i.source)).toEqual(["task"]);
    expect(filterFeed(items, { project: "org", types: [] }).map((i) => i.source)).toEqual(["event"]);
    expect(filterFeed(items, { project: null, types: ["event", "invoice"] }).map((i) => i.source)).toEqual(["event", "invoice"]);
    expect(filterFeed(items, { project: P2, types: ["task"] })).toHaveLength(0);
  });

  it("does not let an event ending at midnight spill into the next day", () => {
    const party = timed("party", "2027-03-10", "20:00", "00:00", P1, "2027-03-11");
    expect(itemDays(party, RIYADH)).toEqual({ start: "2027-03-10", end: "2027-03-10" });
    const overnight = timed("load-in", "2027-03-10", "20:00", "02:00", P1, "2027-03-11");
    expect(itemDays(overnight, RIYADH)).toEqual({ start: "2027-03-10", end: "2027-03-11" });
  });

  it("marks finished work as done", () => {
    expect(isDone(feed({ source: "task", status: "done" }))).toBe(true);
    expect(isDone(feed({ source: "milestone", status: "open" }))).toBe(false);
    expect(isDone(feed({ source: "invoice", status: "paid" }))).toBe(true);
    expect(isDone(feed({ source: "project", status: "done" }))).toBe(false);
  });
});

describe("grouping by day", () => {
  const range = { start: "2027-03-01", end: "2027-03-31" };

  it("groups chronologically, all-day items before timed ones", () => {
    const groups = groupByDay([
      timed("late", "2027-03-10", "15:00", "16:00"),
      feed({ title: "task", start_date: "2027-03-10", end_date: "2027-03-10" }),
      timed("early", "2027-03-10", "09:00", "10:00"),
      feed({ title: "first", start_date: "2027-03-02", end_date: "2027-03-02" }),
    ], range, RIYADH);
    expect(groups.map((g) => g.date)).toEqual(["2027-03-02", "2027-03-10"]);
    expect(groups[1].items.map((i) => i.title)).toEqual(["task", "early", "late"]);
  });

  it("lists a multi-day item once, on its first day inside the range", () => {
    const groups = groupByDay([
      feed({ source: "project", title: "gala", start_date: "2027-02-20", end_date: "2027-03-05" }),
      feed({ source: "phase", title: "build", start_date: "2027-03-08", end_date: "2027-03-12" }),
      feed({ title: "outside", start_date: "2027-04-02", end_date: "2027-04-02" }),
    ], range, RIYADH);
    expect(groups).toEqual([
      { date: "2027-03-01", items: [expect.objectContaining({ title: "gala" })] },
      { date: "2027-03-08", items: [expect.objectContaining({ title: "build" })] },
    ]);
  });

  it("groups by the organisation's day, not UTC", () => {
    // 01:30 on 1 January in Riyadh is still 31 December in UTC; the feed dates it in the zone.
    const newYear = timed("new year", "2027-01-01", "01:30", "02:30");
    expect(groupByDay([newYear], { start: "2027-01-01", end: "2027-01-31" }, RIYADH).map((g) => g.date)).toEqual(["2027-01-01"]);
  });

  it("finds everything occupying one day", () => {
    const items = [
      feed({ title: "span", start_date: "2027-03-08", end_date: "2027-03-12" }),
      feed({ title: "other day", start_date: "2027-03-13", end_date: "2027-03-13" }),
    ];
    expect(itemsOnDay(items, "2027-03-10", RIYADH).map((i) => i.title)).toEqual(["span"]);
  });
});

describe("month and week layout", () => {
  it("stacks overlapping spans in lanes and counts what does not fit", () => {
    const week = "2027-03-07"; // Sunday
    const items = [
      feed({ title: "long", start_date: "2027-03-01", end_date: "2027-03-09" }), // continues from last week
      feed({ title: "mon", start_date: "2027-03-08", end_date: "2027-03-08" }),
      feed({ title: "tue", start_date: "2027-03-09", end_date: "2027-03-09" }),
      feed({ title: "wed-sat", start_date: "2027-03-10", end_date: "2027-03-20" }), // continues to next week
      feed({ title: "mon 2", start_date: "2027-03-08", end_date: "2027-03-08" }),
    ];
    const { segments, hiddenByDay, laneCount } = layoutWeek(week, items, RIYADH, 2);
    const byTitle = Object.fromEntries(segments.map((s) => [s.item.title, s]));
    expect(byTitle.long).toMatchObject({ startCol: 0, span: 3, lane: 0, continuesBefore: true, continuesAfter: false });
    expect(byTitle["wed-sat"]).toMatchObject({ startCol: 3, span: 4, lane: 0, continuesAfter: true });
    expect(byTitle.mon.lane).toBe(1);
    expect(byTitle.tue.lane).toBe(1);
    expect(byTitle["mon 2"]).toBeUndefined();
    expect(hiddenByDay).toEqual([0, 1, 0, 0, 0, 0, 0]);
    expect(laneCount).toBe(2);
  });

  it("keeps custom events visible on a busy day and lets task due dates overflow first", () => {
    const items = [
      feed({ title: "task 1" }),
      feed({ title: "task 2" }),
      feed({ source: "milestone", title: "milestone" }),
      timed("meeting", "2027-03-10", "10:00", "11:00"),
    ];
    const { segments, hiddenByDay } = layoutWeek("2027-03-07", items, RIYADH, 3);
    expect(segments.map((s) => [s.item.title, s.lane])).toEqual([["meeting", 0], ["milestone", 1], ["task 1", 2]]);
    expect(hiddenByDay[3]).toBe(1);
  });

  it("places overlapping timed events side by side", () => {
    const blocks = layoutDayEvents([
      timed("a", "2027-03-10", "09:00", "11:00"),
      timed("b", "2027-03-10", "10:00", "12:00"),
      timed("c", "2027-03-10", "11:00", "12:00"),
      timed("d", "2027-03-10", "13:00", "13:00"),
    ], RIYADH);
    const by = Object.fromEntries(blocks.map((b) => [b.item.title, b]));
    expect(by.a).toMatchObject({ start: 540, end: 660, col: 0, cols: 2 });
    expect(by.b).toMatchObject({ start: 600, end: 720, col: 1, cols: 2 });
    expect(by.c).toMatchObject({ col: 0, cols: 2 });
    // A zero-length event still gets a visible block, alone in its group.
    expect(by.d).toMatchObject({ start: 780, end: 810, col: 0, cols: 1 });
  });
});

describe("overlap detection", () => {
  const h = (hours: number) => Date.UTC(2027, 2, 10, hours);

  it("compares time ranges", () => {
    expect(intervalsOverlap(h(10), h(12), h(11), h(13))).toBe(true);
    expect(intervalsOverlap(h(10), h(14), h(11), h(12))).toBe(true);
    expect(intervalsOverlap(h(10), h(11), h(10), h(11))).toBe(true);
    expect(intervalsOverlap(h(10), h(11), h(11), h(12))).toBe(false);
    expect(intervalsOverlap(h(12), h(13), h(10), h(11))).toBe(false);
    expect(intervalsOverlap(h(11), h(11), h(10), h(12))).toBe(true);
    expect(intervalsOverlap(h(10), h(12), h(10), h(10))).toBe(true);
    expect(intervalsOverlap(h(12), h(12), h(10), h(12))).toBe(false);
    expect(intervalsOverlap(h(9), h(9), h(9), h(9))).toBe(true);
  });

  it("warns about timed events in the same project, ignoring itself, other scopes and all-day items", () => {
    const items = [
      timed("visit", "2027-03-17", "10:00", "12:00", P1),
      timed("other project", "2027-03-17", "10:00", "12:00", P2),
      timed("org meeting", "2027-03-17", "10:00", "12:00", null),
      timed("after", "2027-03-17", "12:00", "13:00", P1),
      feed({ source: "event", title: "all day", start_date: "2027-03-17", end_date: "2027-03-17" }),
      feed({ source: "task", title: "task", start_date: "2027-03-17", end_date: "2027-03-17" }),
    ];
    const candidate = {
      projectId: P1,
      startsAt: zonedInputToUtc("2027-03-17T11:00", RIYADH) as string,
      endsAt: zonedInputToUtc("2027-03-17T12:30", RIYADH) as string,
    };
    expect(findOverlaps(candidate, items).map((i) => i.title)).toEqual(["visit", "after"]);
    expect(findOverlaps({ ...candidate, id: "visit" }, items).map((i) => i.title)).toEqual(["after"]);
    // Organisation-wide events are compared with the other organisation-wide events.
    expect(findOverlaps({ ...candidate, projectId: null }, items).map((i) => i.title)).toEqual(["org meeting"]);
    // An end before the start has no overlaps to report (the form shows that error instead).
    expect(findOverlaps({ ...candidate, endsAt: candidate.startsAt.replace("08:00", "07:00") }, items)).toEqual([]);
  });

  it("works on database rows too", () => {
    const rows = [{ id: "x", projectId: null, startsAt: "2027-03-17T07:00:00+00:00", endsAt: "2027-03-17T08:00:00+00:00", title: "x" }];
    expect(overlappingEvents({ projectId: null, startsAt: "2027-03-17T07:30:00Z", endsAt: "2027-03-17T07:45:00Z" }, rows)).toHaveLength(1);
    expect(overlappingEvents({ projectId: P1, startsAt: "2027-03-17T07:30:00Z", endsAt: "2027-03-17T07:45:00Z" }, rows)).toHaveLength(0);
  });
});

describe("who may write", () => {
  it("mirrors private.can_contribute", () => {
    expect(canContribute(accessFor("admin", []))).toBe(true);
    expect(canContribute(accessFor("staff", ["operations_access"]))).toBe(true);
    expect(canContribute(accessFor("staff", ["finance_access"]))).toBe(true);
    expect(canContribute(accessFor("staff", []))).toBe(false);
    expect(canContribute(accessFor(null, null))).toBe(false);
  });

  it("mirrors private.can_edit for projects", () => {
    const projects = [{ id: P1 }, { id: P2 }];
    const memberships = [{ project_id: P1, role: "editor" }, { project_id: P2, role: "viewer" }, { project_id: "elsewhere", role: "owner" }];
    expect(editableProjectIds(projects, memberships, false)).toEqual([P1]);
    expect(editableProjectIds(projects, [], true)).toEqual([P1, P2]);
  });
});

describe("event form validation", () => {
  const base = { title: "Supplier meeting", kind: "meeting", project_id: "", start: "2027-03-10T10:00", end: "2027-03-10T11:00" };

  it("accepts a timed organisation-wide event and converts the times", () => {
    const res = parseEventForm(base, RIYADH);
    expect(res).toEqual({
      ok: true,
      value: {
        title: "Supplier meeting", kind: "meeting", projectId: null, allDay: false,
        startsAt: "2027-03-10T07:00:00.000Z", endsAt: "2027-03-10T08:00:00.000Z", location: "", description: "",
      },
    });
  });

  it("stores all-day events from the first day's start to the last day's end in the zone", () => {
    const res = parseEventForm({ ...base, project_id: P1, all_day: "on", start: "2027-03-10", end: "2027-03-12" }, RIYADH);
    expect(res.ok && res.value).toMatchObject({
      projectId: P1, allDay: true, startsAt: "2027-03-09T21:00:00.000Z", endsAt: "2027-03-12T20:59:59.000Z",
    });
  });

  it("refuses an end before the start, a missing or long title, an unknown kind and bad ids", () => {
    expect(parseEventForm({ ...base, end: "2027-03-10T09:59" }, RIYADH)).toEqual({ ok: false, error: "يجب ألا تسبق النهاية البداية." });
    expect(parseEventForm({ ...base, all_day: "on", start: "2027-03-12", end: "2027-03-10" }, RIYADH).ok).toBe(false);
    expect(parseEventForm({ ...base, title: "   " }, RIYADH)).toEqual({ ok: false, error: "اكتب عنوان الحدث." });
    expect(parseEventForm({ ...base, title: "ع".repeat(301) }, RIYADH).ok).toBe(false);
    expect(parseEventForm({ ...base, title: "ع".repeat(300) }, RIYADH).ok).toBe(true);
    expect(parseEventForm({ ...base, kind: "party" }, RIYADH).ok).toBe(false);
    expect(parseEventForm({ ...base, project_id: "1 or 1=1" }, RIYADH).ok).toBe(false);
    expect(parseEventForm({ ...base, start: "" }, RIYADH).ok).toBe(false);
    expect(parseEventForm({ ...base, location: "x".repeat(301) }, RIYADH).ok).toBe(false);
    expect(parseEventForm({ ...base, description: "x".repeat(4001) }, RIYADH).ok).toBe(false);
  });

  it("allows a zero-length event (a moment, such as a deadline)", () => {
    expect(parseEventForm({ ...base, kind: "deadline", end: base.start }, RIYADH).ok).toBe(true);
  });
});
