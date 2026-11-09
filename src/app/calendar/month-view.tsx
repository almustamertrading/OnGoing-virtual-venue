"use client";

import { Fragment, useMemo } from "react";
import {
  feedItemKey,
  formatDayLong,
  formatMonthTitle,
  formatTime,
  isDone,
  itemDays,
  layoutWeek,
  monthGridWeeks,
  weekdayNames,
} from "@/lib/calendar";
import { itemStyle } from "@/lib/calendar-meta";
import type { CalendarFeedItem } from "@/lib/types";
import { ItemLink, SOURCE_ICON } from "./feed-item";

/** Item rows per week before the rest collapse into "+N more". */
const MAX_LANES = 3;

type Props = {
  anchor: string;
  items: CalendarFeedItem[];
  timeZone: string;
  today: string;
  onOpenEvent: (item: CalendarFeedItem) => void;
  onOpenDay: (day: string) => void;
};

/** Sunday-first month grid; multi-day items span across the days they cover. */
export function MonthView({ anchor, items, timeZone, today, onOpenEvent, onOpenDay }: Props) {
  const weeks = useMemo(() => monthGridWeeks(anchor), [anchor]);
  const month = anchor.slice(0, 7);
  return (
    <section aria-label={`شهر ${formatMonthTitle(anchor)}`} className="card overflow-hidden" data-testid="month-grid">
      <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/60 text-center text-xs font-medium text-slate-400" aria-hidden>
        {weekdayNames().map((name) => (
          <div key={name} className="py-2">{name}</div>
        ))}
      </div>
      {weeks.map((week) => (
        <WeekRow
          key={week[0]}
          week={week}
          month={month}
          items={items}
          timeZone={timeZone}
          today={today}
          onOpenEvent={onOpenEvent}
          onOpenDay={onOpenDay}
        />
      ))}
    </section>
  );
}

function WeekRow({
  week,
  month,
  items,
  timeZone,
  today,
  onOpenEvent,
  onOpenDay,
}: Omit<Props, "anchor"> & { week: string[]; month: string }) {
  const { segments, hiddenByDay } = useMemo(
    () => layoutWeek(week[0], items, timeZone, MAX_LANES),
    [week, items, timeZone],
  );

  return (
    <div
      className="grid grid-cols-7 border-b border-slate-800 last:border-b-0"
      style={{ gridTemplateRows: `2rem repeat(${MAX_LANES}, 1.5rem) 1.5rem` }}
    >
      {week.map((day, i) => {
        const inMonth = day.startsWith(month);
        const isToday = day === today;
        return (
          <Fragment key={day}>
            <div
              className={`border-slate-800 ${i > 0 ? "border-s" : ""} ${isToday ? "bg-emerald-500/[0.06]" : inMonth ? "" : "bg-slate-950/50"}`}
              style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
            />
            <div className="flex items-start p-1" style={{ gridColumn: i + 1, gridRow: 1 }}>
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                aria-label={isToday ? `${formatDayLong(day)}، اليوم` : formatDayLong(day)}
                aria-current={isToday ? "date" : undefined}
                className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                  isToday
                    ? "bg-emerald-500 font-bold text-slate-950"
                    : inMonth
                      ? "text-slate-200 hover:bg-slate-800"
                      : "text-slate-600 hover:bg-slate-800"
                }`}
              >
                {Number(day.slice(8))}
              </button>
            </div>
          </Fragment>
        );
      })}

      {segments.map((seg) => {
        const { item } = seg;
        const days = itemDays(item, timeZone);
        const showTime = !item.all_day && item.starts_at && days.start === days.end;
        // Dates from other modules carry their icon too, so the type never depends on colour alone.
        const Icon = item.source === "event" ? null : SOURCE_ICON[item.source];
        return (
          <div
            key={`${feedItemKey(item)}:${week[0]}`}
            className="z-10 min-w-0 px-0.5 py-px"
            style={{ gridColumn: `${seg.startCol + 1} / span ${seg.span}`, gridRow: seg.lane + 2 }}
          >
            <ItemLink
              item={item}
              timeZone={timeZone}
              onOpenEvent={onOpenEvent}
              className={`flex h-full w-full min-w-0 items-center gap-1 rounded px-1.5 text-start text-[11px] leading-none ${itemStyle(item).chip} ${
                seg.continuesBefore ? "rounded-s-none" : ""
              } ${seg.continuesAfter ? "rounded-e-none" : ""} ${isDone(item) ? "line-through opacity-60" : ""}`}
            >
              {showTime && <span className="shrink-0 font-mono text-[10px] opacity-80">{formatTime(item.starts_at as string, timeZone)}</span>}
              {Icon && <Icon size={11} className="shrink-0 opacity-80" aria-hidden />}
              <span dir="auto" className="truncate">{item.title}</span>
            </ItemLink>
          </div>
        );
      })}

      {hiddenByDay.map((count, i) =>
        count > 0 ? (
          <div key={`more-${week[i]}`} className="z-10 min-w-0 px-1" style={{ gridColumn: i + 1, gridRow: MAX_LANES + 2 }}>
            <button
              type="button"
              onClick={() => onOpenDay(week[i])}
              aria-label={`${count} مواعيد أخرى في ${formatDayLong(week[i])}`}
              className="truncate rounded px-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              +{count} أخرى
            </button>
          </div>
        ) : null,
      )}
    </div>
  );
}
