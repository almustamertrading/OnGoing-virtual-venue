"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  dayOfWeek,
  eachDay,
  feedItemKey,
  formatDayLong,
  formatPeriodTitle,
  formatTime,
  isDone,
  itemDays,
  layoutDayEvents,
  layoutWeek,
  weekRange,
  weekdayName,
} from "@/lib/calendar";
import { itemStyle } from "@/lib/calendar-meta";
import type { CalendarFeedItem } from "@/lib/types";
import { ItemLink, SOURCE_ICON } from "./feed-item";

const HOUR_PX = 48;
const COLUMNS = "grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]";
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

type Props = {
  anchor: string;
  items: CalendarFeedItem[];
  timeZone: string;
  today: string;
  /** Minutes since midnight in the organisation's zone, for the "now" line. */
  nowMinutes: number;
  onOpenEvent: (item: CalendarFeedItem) => void;
  onOpenDay: (day: string) => void;
};

/** Seven day columns: all-day and multi-day items on top, timed events placed by the hour. */
export function WeekView({ anchor, items, timeZone, today, nowMinutes, onOpenEvent, onOpenDay }: Props) {
  const { start, end } = weekRange(anchor);
  const days = useMemo(() => eachDay(start, end), [start, end]);

  const { top, timedByDay } = useMemo(() => {
    const allDay: CalendarFeedItem[] = [];
    const byDay = new Map<string, CalendarFeedItem[]>();
    for (const item of items) {
      const d = itemDays(item, timeZone);
      if (item.all_day || !item.starts_at || !item.ends_at || d.start !== d.end) allDay.push(item);
      else byDay.set(d.start, [...(byDay.get(d.start) ?? []), item]);
    }
    return { top: layoutWeek(start, allDay, timeZone), timedByDay: byDay };
  }, [items, timeZone, start]);

  // Open at the working day (07:00, label fully visible) rather than midnight.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX - 12;
  }, []);

  return (
    <section aria-label={`أسبوع ${formatPeriodTitle("week", anchor)}`} className="card overflow-x-auto" data-testid="week-grid">
      <div className="min-w-[44rem]">
        <div className={`grid ${COLUMNS} border-b border-slate-800`}>
          <div />
          {days.map((day) => {
            const isToday = day === today;
            return (
              <div key={day} className="border-s border-slate-800 px-1 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={isToday ? `${formatDayLong(day)}، اليوم` : formatDayLong(day)}
                  aria-current={isToday ? "date" : undefined}
                  className="w-full rounded-md py-0.5 hover:bg-slate-800"
                >
                  <span className="block text-[11px] text-slate-400">{weekdayName(dayOfWeek(day))}</span>
                  <span
                    className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      isToday ? "bg-emerald-500 font-bold text-slate-950" : "text-slate-100"
                    }`}
                  >
                    {Number(day.slice(8))}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div
          className={`grid ${COLUMNS} border-b border-slate-800`}
          style={{ gridTemplateRows: `repeat(${Math.max(1, top.laneCount)}, 1.625rem)` }}
        >
          <div className="flex items-center justify-center px-1 text-center text-[10px] leading-tight text-slate-500" style={{ gridColumn: 1, gridRow: "1 / -1" }}>
            طوال اليوم
          </div>
          {days.map((day, i) => (
            <div key={day} className="border-s border-slate-800" style={{ gridColumn: i + 2, gridRow: "1 / -1" }} />
          ))}
          {top.segments.map((seg) => {
            const Icon = seg.item.source === "event" ? null : SOURCE_ICON[seg.item.source];
            return (
              <div
                key={feedItemKey(seg.item)}
                className="z-10 min-w-0 px-0.5 py-0.5"
                style={{ gridColumn: `${seg.startCol + 2} / span ${seg.span}`, gridRow: seg.lane + 1 }}
              >
                <ItemLink
                  item={seg.item}
                  timeZone={timeZone}
                  onOpenEvent={onOpenEvent}
                  className={`flex h-full w-full min-w-0 items-center gap-1 rounded px-1.5 text-start text-[11px] leading-none ${itemStyle(seg.item).chip} ${
                    seg.continuesBefore ? "rounded-s-none" : ""
                  } ${seg.continuesAfter ? "rounded-e-none" : ""} ${isDone(seg.item) ? "line-through opacity-60" : ""}`}
                >
                  {Icon && <Icon size={11} className="shrink-0 opacity-80" aria-hidden />}
                  <span dir="auto" className="truncate">{seg.item.title}</span>
                </ItemLink>
              </div>
            );
          })}
        </div>

        <div ref={scrollRef} className="max-h-[32rem] overflow-y-auto">
          <div className={`grid ${COLUMNS}`} style={{ height: 24 * HOUR_PX }}>
            <div className="relative" aria-hidden>
              {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                <span
                  key={h}
                  className="absolute inset-x-0 -translate-y-1/2 text-center font-mono text-[10px] text-slate-500"
                  style={{ top: h * HOUR_PX }}
                >
                  {hourLabel(h)}
                </span>
              ))}
            </div>
            {days.map((day) => (
              <div
                key={day}
                className="relative border-s border-slate-800"
                style={{
                  backgroundImage: "linear-gradient(to bottom, rgb(30 41 59 / 0.8) 1px, transparent 1px)",
                  backgroundSize: `100% ${HOUR_PX}px`,
                }}
              >
                {layoutDayEvents(timedByDay.get(day) ?? [], timeZone).map((block) => (
                  <div
                    key={feedItemKey(block.item)}
                    className="absolute z-10 p-px"
                    style={{
                      top: (block.start / 60) * HOUR_PX,
                      height: ((block.end - block.start) / 60) * HOUR_PX,
                      insetInlineStart: `${(block.col / block.cols) * 100}%`,
                      width: `${100 / block.cols}%`,
                    }}
                  >
                    <ItemLink
                      item={block.item}
                      timeZone={timeZone}
                      onOpenEvent={onOpenEvent}
                      className={`flex h-full w-full flex-col overflow-hidden rounded px-1.5 py-0.5 text-start text-[11px] leading-tight ${itemStyle(block.item).chip}`}
                    >
                      {/* Side-by-side blocks are narrow: the start time only (the full range is in the name). */}
                      <span className="truncate whitespace-nowrap font-mono text-[10px] opacity-80">
                        {formatTime(block.item.starts_at as string, timeZone)}
                        {block.cols === 1 && `–${formatTime(block.item.ends_at as string, timeZone)}`}
                      </span>
                      <span dir="auto" className="truncate text-right font-medium">{block.item.title}</span>
                    </ItemLink>
                  </div>
                ))}
                {day === today && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-400"
                    style={{ top: (nowMinutes / 60) * HOUR_PX }}
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
