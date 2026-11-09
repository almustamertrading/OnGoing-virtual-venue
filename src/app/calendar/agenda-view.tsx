"use client";

import { Fragment, useMemo } from "react";
import { describeWhen, feedItemKey, formatDayLong, groupByDay, isDone, type DateRange } from "@/lib/calendar";
import { itemStyle, itemTypeLabel } from "@/lib/calendar-meta";
import type { CalendarFeedItem } from "@/lib/types";
import { ItemLink, SOURCE_ICON } from "./feed-item";

type Props = {
  range: DateRange;
  items: CalendarFeedItem[];
  timeZone: string;
  today: string;
  /** Location of custom events, by id. */
  locations: Record<string, string>;
  label: string;
  testId: string;
  onOpenEvent: (item: CalendarFeedItem) => void;
};

/** A chronological list grouped by day; a multi-day item is listed on its first day in the range. */
export function AgendaView({ range, items, timeZone, today, locations, label, testId, onOpenEvent }: Props) {
  const groups = useMemo(() => groupByDay(items, range, timeZone), [items, range, timeZone]);

  if (groups.length === 0) {
    return (
      <p className="card p-8 text-center text-sm text-slate-400" data-testid={testId}>
        لا توجد مواعيد في هذه الفترة.
      </p>
    );
  }

  return (
    <section aria-label={label} data-testid={testId}>
      <ol className="space-y-5">
        {groups.map((group) => {
          const headingId = `${testId}-${group.date}`;
          return (
            <li key={group.date} aria-labelledby={headingId}>
              <h3
                id={headingId}
                className={`mb-2 flex items-center gap-2 text-sm font-semibold ${group.date === today ? "text-emerald-300" : "text-slate-200"}`}
              >
                {formatDayLong(group.date)}
                {group.date === today && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">اليوم</span>
                )}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={feedItemKey(item)}>
                    <AgendaRow item={item} timeZone={timeZone} location={item.source === "event" ? locations[item.source_id] : ""} onOpenEvent={onOpenEvent} />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** One item as a full-width row; also used in the day dialog. */
export function AgendaRow({
  item,
  timeZone,
  location,
  onOpenEvent,
}: {
  item: CalendarFeedItem;
  timeZone: string;
  location?: string;
  onOpenEvent: (item: CalendarFeedItem) => void;
}) {
  const Icon = SOURCE_ICON[item.source];
  // Each part is isolated (<bdi>) so codes such as "2026-001" keep their order in Arabic text.
  // Times read right to left like the rest of the page (start on the right).
  const parts: { text: string; dir?: "rtl"; wrap?: boolean }[] = [
    { text: describeWhen(item, timeZone), dir: "rtl" },
    { text: itemTypeLabel(item) },
    { text: item.label ?? "" },
    { text: location ?? "", wrap: true },
  ];
  const meta = parts.filter((part) => part.text);
  return (
    <ItemLink
      item={item}
      timeZone={timeZone}
      onOpenEvent={onOpenEvent}
      extraName={location || undefined}
      className="card flex w-full items-stretch gap-3 p-3 text-start transition hover:border-slate-600 hover:bg-white/[0.03]"
    >
      <span className={`w-1 shrink-0 rounded-full ${itemStyle(item).dot}`} aria-hidden />
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
      <span className="min-w-0 flex-1">
        {/* dir="auto": a Latin title is cut at its end, not its start; text-right keeps the RTL alignment. */}
        <span dir="auto" className={`block truncate text-right text-sm font-medium text-slate-100 ${isDone(item) ? "line-through opacity-60" : ""}`}>
          {item.title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-400">
          {meta.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && " · "}
              <bdi dir={part.dir} className={part.wrap ? "break-words" : "whitespace-nowrap"}>{part.text}</bdi>
            </Fragment>
          ))}
        </span>
      </span>
    </ItemLink>
  );
}
