"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, TriangleAlert, X } from "lucide-react";
import {
  CALENDAR_VIEWS,
  EVENT_KINDS,
  FEED_SOURCES,
  ORG_WIDE,
  calendarHref,
  describeWhen,
  filterFeed,
  formatMonthTitle,
  formatPeriodTitle,
  monthRange,
  shiftAnchor,
  zonedDate,
  type CalendarFilters,
  type CalendarView,
  type DateRange,
  type FeedSource,
} from "@/lib/calendar";
import { EVENT_KIND_LABEL, KIND_STYLE, SOURCE_FILTER_LABEL, SOURCE_LABEL, SOURCE_STYLE } from "@/lib/calendar-meta";
import type { CalendarFeedItem } from "@/lib/types";
import type { EventActionState, OverlapNote } from "./actions";
import { AgendaView } from "./agenda-view";
import { DayDialog } from "./day-dialog";
import { EventDialog, draftFromItem, newDraft, type EventDetails, type EventDraft, type ProjectOption } from "./event-dialog";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";

export type { EventDetails, ProjectOption } from "./event-dialog";

const VIEW_LABEL: Record<CalendarView, string> = { month: "شهر", week: "أسبوع", agenda: "قائمة" };

type DialogPayload = { kind: "event"; draft: EventDraft; readOnly: boolean } | { kind: "day"; day: string };
/** The open dialog. Each opening gets its own id, so a late "close" from the previous one never closes it. */
type DialogState = DialogPayload & { id: number };

type Notice = { text: string; title: string; overlaps: OverlapNote[] };

type Props = {
  timeZone: string;
  today: string;
  nowMinutes: number;
  view: CalendarView;
  anchor: string;
  /** Whether the URL named the anchor date (otherwise it is today and links keep it that way). */
  explicitDate: boolean;
  range: DateRange;
  initialFilters: CalendarFilters;
  /** The whole feed for the range; filters are applied here so changing them needs no reload. */
  items: CalendarFeedItem[];
  details: Record<string, EventDetails>;
  projects: ProjectOption[];
  canCreateOrgEvents: boolean;
  editableProjectIds: string[];
  showInvoices: boolean;
  feedError: string | null;
};

/** An overlap reported by the server, shaped like a feed row so it is described the same way. */
function noteItem(note: OverlapNote, timeZone: string): CalendarFeedItem {
  return {
    source: "event", source_id: note.id, project_id: null, label: null, title: note.title, all_day: false,
    start_date: zonedDate(note.startsAt, timeZone), end_date: zonedDate(note.endsAt, timeZone),
    starts_at: note.startsAt, ends_at: note.endsAt, kind: "meeting", status: null,
  };
}

export function CalendarBoard({
  timeZone,
  today,
  nowMinutes,
  view,
  anchor,
  explicitDate,
  range,
  initialFilters,
  items,
  details,
  projects,
  canCreateOrgEvents,
  editableProjectIds,
  showInvoices,
  feedError,
}: Props) {
  const [filters, setFilters] = useState<CalendarFilters>(initialFilters);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const dialogCount = useRef(0);
  const showDialog = (next: DialogPayload) => setDialog({ ...next, id: ++dialogCount.current });
  const closeDialog = (id: number) => setDialog((current) => (current?.id === id ? null : current));

  const editableProjects = useMemo(() => {
    const ids = new Set(editableProjectIds);
    return projects.filter((p) => ids.has(p.id));
  }, [projects, editableProjectIds]);
  const canWrite = canCreateOrgEvents || editableProjects.length > 0;
  const sources = useMemo(() => FEED_SOURCES.filter((s) => s !== "invoice" || showInvoices), [showInvoices]);
  const shown = useMemo(() => filterFeed(items, filters), [items, filters]);
  const locations = useMemo(
    () => Object.fromEntries(Object.entries(details).map(([id, d]) => [id, d.location])),
    [details],
  );
  const month = useMemo(() => monthRange(anchor), [anchor]);

  const hrefWith = (patch: { view?: CalendarView; date?: string | null }, f: CalendarFilters = filters) =>
    calendarHref({ view, date: explicitDate ? anchor : null, project: f.project, types: f.types, ...patch });

  const applyFilters = (next: CalendarFilters) => {
    setFilters(next);
    // Filters only change what is shown: update the address (shareable, survives a reload)
    // without asking the server for the same data again.
    window.history.replaceState(null, "", hrefWith({}, next));
  };

  const toggleSource = (source: FeedSource, on: boolean) => {
    const current = filters.types.length ? filters.types : sources;
    const next = on ? [...current, source] : current.filter((s) => s !== source);
    const types = sources.filter((s) => next.includes(s));
    applyFilters({ ...filters, types: types.length === sources.length ? [] : types });
  };

  const openCreate = (day?: string) => {
    const date = day ?? (today >= range.start && today <= range.end ? today : anchor);
    const filtered = editableProjects.find((p) => p.id === filters.project)?.id;
    const projectId = filtered ?? (canCreateOrgEvents ? "" : (editableProjects[0]?.id ?? ""));
    showDialog({ kind: "event", draft: newDraft(date, projectId), readOnly: false });
  };

  const openEvent = (item: CalendarFeedItem) => {
    const mayEdit = item.project_id ? editableProjects.some((p) => p.id === item.project_id) : canCreateOrgEvents;
    showDialog({ kind: "event", draft: draftFromItem(item, details[item.source_id], timeZone), readOnly: !mayEdit });
  };

  const openDay = (day: string) => showDialog({ kind: "day", day });
  const onSaved = (result: EventActionState) =>
    setNotice({ text: "تم حفظ الحدث", title: result.title ?? "", overlaps: result.overlaps ?? [] });
  const onDeleted = (title: string) => setNotice({ text: "تم حذف الحدث", title, overlaps: [] });

  const unit = view === "week" ? "الأسبوع" : "الشهر";

  return (
    <main dir="rtl" className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-white">التقويم</h1>
          <p className="text-sm text-slate-400">
            مواعيد المنظمة في مكان واحد: الأحداث وفترات المشاريع والمهام والمحطات ومراحل الخطط والعروض وطلبات التسعير
            {showInvoices ? " واستحقاقات الفواتير" : ""}.
          </p>
        </div>
        {canWrite && (
          <button type="button" className="btn-primary" onClick={() => openCreate()}>
            <Plus size={16} aria-hidden /> حدث جديد
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={hrefWith({ date: shiftAnchor(view, anchor, -1) })} aria-label={`${unit} السابق`} className="btn-ghost px-2">
            <ChevronRight size={16} aria-hidden />
          </Link>
          <Link href={hrefWith({ date: null })} className="btn-ghost">اليوم</Link>
          <Link href={hrefWith({ date: shiftAnchor(view, anchor, 1) })} aria-label={`${unit} التالي`} className="btn-ghost px-2">
            <ChevronLeft size={16} aria-hidden />
          </Link>
        </div>
        <h2 className="text-lg font-semibold text-white">{formatPeriodTitle(view, anchor)}</h2>
        <nav aria-label="طريقة العرض" className="ms-auto flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
          {CALENDAR_VIEWS.map((v) => (
            <Link
              key={v}
              href={hrefWith({ view: v })}
              aria-current={v === view ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm ${v === view ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {VIEW_LABEL[v]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="card space-y-3 p-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="w-full sm:w-72">
            <label className="label" htmlFor="cal-project">المشروع</label>
            <select
              id="cal-project"
              className="field"
              value={filters.project ?? ""}
              onChange={(e) => applyFilters({ ...filters, project: e.target.value || null })}
            >
              <option value="">كل المشاريع</option>
              <option value={ORG_WIDE}>على مستوى المنظمة فقط</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
              ))}
            </select>
          </div>
          <fieldset className="min-w-0 flex-1">
            <legend className="label">المصادر</legend>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s) => {
                const checked = filters.types.length === 0 || filters.types.includes(s);
                return (
                  <label
                    key={s}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                      checked ? "border-slate-600 bg-slate-800 text-slate-100" : "border-slate-800 text-slate-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      // At least one source stays selected.
                      disabled={checked && filters.types.length === 1}
                      onChange={(e) => toggleSource(s, e.target.checked)}
                      className="accent-emerald-500"
                    />
                    {SOURCE_FILTER_LABEL[s]}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
        <Legend sources={sources} />
      </div>

      <div role="status" aria-live="polite" data-testid="calendar-notice">
        {notice && (
          <div className="card flex items-start gap-3 border-emerald-900 bg-emerald-950/30 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="text-emerald-200">
                {notice.text} <bdi>«{notice.title}»</bdi>.
              </p>
              {notice.overlaps.length > 0 && (
                <div className="mt-1 text-amber-200">
                  <p className="flex items-center gap-1.5">
                    <TriangleAlert size={14} className="shrink-0" aria-hidden /> تنبيه تداخل: يتداخل هذا الحدث مع:
                  </p>
                  <ul className="list-disc ps-5 text-xs">
                    {notice.overlaps.map((o) => (
                      <li key={o.id}>
                        <bdi>{o.title}</bdi> (<bdi dir="rtl">{describeWhen(noteItem(o, timeZone), timeZone, { withDate: true })}</bdi>)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button type="button" aria-label="إخفاء التنبيه" onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
              <X size={16} aria-hidden />
            </button>
          </div>
        )}
      </div>

      {feedError && (
        <p role="alert" className="card border-red-900 p-3 text-sm text-red-300">تعذّر تحميل التقويم: {feedError}</p>
      )}

      {view === "month" && (
        <>
          <div className="hidden md:block">
            <MonthView anchor={anchor} items={shown} timeZone={timeZone} today={today} onOpenEvent={openEvent} onOpenDay={openDay} />
          </div>
          {/* Below the md breakpoint the month is listed day by day instead of a grid. */}
          <div className="md:hidden">
            <AgendaView
              range={month}
              items={shown}
              timeZone={timeZone}
              today={today}
              locations={locations}
              label={`مواعيد ${formatMonthTitle(anchor)}`}
              testId="month-agenda"
              onOpenEvent={openEvent}
            />
          </div>
        </>
      )}
      {view === "week" && (
        <WeekView anchor={anchor} items={shown} timeZone={timeZone} today={today} nowMinutes={nowMinutes} onOpenEvent={openEvent} onOpenDay={openDay} />
      )}
      {view === "agenda" && (
        <AgendaView
          range={range}
          items={shown}
          timeZone={timeZone}
          today={today}
          locations={locations}
          label={`قائمة مواعيد ${formatMonthTitle(anchor)}`}
          testId="agenda-list"
          onOpenEvent={openEvent}
        />
      )}

      {dialog?.kind === "event" && (
        <EventDialog
          key={dialog.id}
          draft={dialog.draft}
          readOnly={dialog.readOnly}
          timeZone={timeZone}
          items={items}
          projects={projects}
          editableProjects={editableProjects}
          canCreateOrgEvents={canCreateOrgEvents}
          onSaved={onSaved}
          onDeleted={onDeleted}
          onClose={() => closeDialog(dialog.id)}
        />
      )}
      {dialog?.kind === "day" && (
        <DayDialog
          key={dialog.id}
          day={dialog.day}
          items={shown}
          timeZone={timeZone}
          locations={locations}
          canWrite={canWrite}
          onAdd={openCreate}
          onOpenEvent={openEvent}
          onClose={() => closeDialog(dialog.id)}
        />
      )}
    </main>
  );
}

function Legend({ sources }: { sources: readonly FeedSource[] }) {
  return (
    <section aria-labelledby="cal-legend" className="space-y-1.5 border-t border-slate-800 pt-3 text-[11px] text-slate-400">
      <h3 id="cal-legend" className="sr-only">دليل الألوان</h3>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-slate-300">الأحداث حسب النوع:</span>
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {EVENT_KINDS.map((k) => (
            <li key={k} className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-sm ${KIND_STYLE[k].dot}`} aria-hidden />
              {EVENT_KIND_LABEL[k]}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-slate-300">من المشاريع والوحدات الأخرى:</span>
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {sources.filter((s): s is Exclude<FeedSource, "event"> => s !== "event").map((s) => (
            <li key={s} className="inline-flex items-center gap-1">
              <span className={`h-3 w-1 rounded-full ${SOURCE_STYLE[s].dot}`} aria-hidden />
              {SOURCE_LABEL[s]}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
