"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { Plus, X } from "lucide-react";
import { feedItemKey, formatDayLong, itemsOnDay } from "@/lib/calendar";
import type { CalendarFeedItem } from "@/lib/types";
import { AgendaRow } from "./agenda-view";

/** Everything on one day, including what did not fit in the month grid. */
export function DayDialog({
  day,
  items,
  timeZone,
  locations,
  canWrite,
  onAdd,
  onOpenEvent,
  onClose,
}: {
  day: string;
  items: CalendarFeedItem[];
  timeZone: string;
  locations: Record<string, string>;
  canWrite: boolean;
  onAdd: (day: string) => void;
  onOpenEvent: (item: CalendarFeedItem) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const list = useMemo(() => itemsOnDay(items, day, timeZone), [items, day, timeZone]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      dir="rtl"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (outside the panel) closes the dialog.
        if (e.target === e.currentTarget) close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-800 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-black/60"
    >
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-semibold text-white">{formatDayLong(day)}</h2>
          <button type="button" onClick={close} aria-label="إغلاق" className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X size={18} aria-hidden />
          </button>
        </div>
        {list.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">لا توجد مواعيد في هذا اليوم.</p>
        ) : (
          <ul className="space-y-1.5">
            {list.map((item) => (
              <li key={feedItemKey(item)}>
                <AgendaRow
                  item={item}
                  timeZone={timeZone}
                  location={item.source === "event" ? locations[item.source_id] : ""}
                  onOpenEvent={onOpenEvent}
                />
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <button type="button" className="btn-ghost mt-4 w-full" onClick={() => onAdd(day)}>
            <Plus size={15} aria-hidden /> إضافة حدث في هذا اليوم
          </button>
        )}
      </div>
    </dialog>
  );
}
