"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Save, Trash2, TriangleAlert, X } from "lucide-react";
import {
  DESCRIPTION_MAX,
  EVENT_KINDS,
  LOCATION_MAX,
  TITLE_MAX,
  describeWhen,
  feedItemKey,
  findOverlaps,
  formatDayLong,
  formatDayShort,
  moveEndWithStart,
  utcToZonedInput,
  zonedInputToUtc,
} from "@/lib/calendar";
import { EVENT_KIND_LABEL } from "@/lib/calendar-meta";
import type { CalendarEventKind, CalendarFeedItem } from "@/lib/types";
import { deleteCalendarEvent, saveCalendarEvent, type EventActionState } from "./actions";

export type ProjectOption = { id: string; code: string; name: string };
export type EventDetails = { location: string; description: string };

/** The dialog's editable values. Times are datetime-local strings (or dates when all-day). */
export type EventDraft = {
  id: string | null;
  title: string;
  kind: CalendarEventKind;
  /** "" = organisation-wide. */
  projectId: string;
  allDay: boolean;
  start: string;
  end: string;
  location: string;
  description: string;
};

const isKind = (k: string): k is CalendarEventKind => (EVENT_KINDS as readonly string[]).includes(k);

export function newDraft(day: string, projectId: string): EventDraft {
  return {
    id: null, title: "", kind: "meeting", projectId, allDay: false,
    start: `${day}T09:00`, end: `${day}T10:00`, location: "", description: "",
  };
}

export function draftFromItem(item: CalendarFeedItem, details: EventDetails | undefined, timeZone: string): EventDraft {
  const timed = !item.all_day && item.starts_at && item.ends_at;
  return {
    id: item.source_id,
    title: item.title,
    kind: isKind(item.kind) ? item.kind : "other",
    projectId: item.project_id ?? "",
    allDay: !timed,
    start: timed ? utcToZonedInput(item.starts_at as string, timeZone) : item.start_date,
    end: timed ? utcToZonedInput(item.ends_at as string, timeZone) : item.end_date,
    location: details?.location ?? "",
    description: details?.description ?? "",
  };
}

type Props = {
  draft: EventDraft;
  /** The viewer may read this event but not change it. */
  readOnly: boolean;
  timeZone: string;
  /** The loaded feed, for the overlap warning. */
  items: CalendarFeedItem[];
  /** Every project the viewer can see (for labels). */
  projects: ProjectOption[];
  /** Projects the viewer may add events to. */
  editableProjects: ProjectOption[];
  canCreateOrgEvents: boolean;
  onSaved: (result: EventActionState) => void;
  onDeleted: (title: string) => void;
  onClose: () => void;
};

/** Native modal dialog: focus moves in and is trapped, Escape closes, focus returns on close. */
export function EventDialog(props: Props) {
  const { draft, readOnly, onClose } = props;
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // React's autoFocus runs before showModal(), so focus the first field once the dialog is open.
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);

  const close = () => ref.current?.close();
  const heading = readOnly ? "تفاصيل الحدث" : draft.id ? "تعديل الحدث" : "حدث جديد";

  return (
    <dialog
      ref={ref}
      dir="rtl"
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-black/60"
    >
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-semibold text-white">{heading}</h2>
          <button type="button" onClick={close} aria-label="إغلاق" className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X size={18} aria-hidden />
          </button>
        </div>
        {readOnly ? <EventDetailsView {...props} /> : <EventForm {...props} close={close} />}
      </div>
    </dialog>
  );
}

function projectLabel(projects: ProjectOption[], id: string) {
  const p = projects.find((x) => x.id === id);
  return p ? `${p.code} · ${p.name}` : "مشروع";
}

/** "الجمعة، 12 مارس 2027، 09:00–10:00" from the draft's local values. */
function describeDraft(d: EventDraft) {
  const [startDay, endDay] = [d.start.slice(0, 10), d.end.slice(0, 10)];
  if (d.allDay) {
    return startDay === endDay
      ? `${formatDayLong(startDay)} (طوال اليوم)`
      : `${formatDayShort(startDay)} – ${formatDayShort(endDay)} (طوال اليوم)`;
  }
  const [from, to] = [d.start.slice(11, 16), d.end.slice(11, 16)];
  return startDay === endDay
    ? `${formatDayLong(startDay)}، ${from}–${to}`
    : `${formatDayShort(startDay)} ${from} – ${formatDayShort(endDay)} ${to}`;
}

function EventDetailsView({ draft, timeZone, projects }: Props) {
  const rows: [string, string][] = [
    ["العنوان", draft.title],
    ["النوع", EVENT_KIND_LABEL[draft.kind]],
    ["المشروع", draft.projectId ? projectLabel(projects, draft.projectId) : "على مستوى المنظمة"],
    ["الموعد", describeDraft(draft)],
  ];
  if (draft.location) rows.push(["الموقع", draft.location]);
  if (draft.description) rows.push(["الوصف", draft.description]);
  return (
    <div className="space-y-4">
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[6rem_1fr] gap-2">
            <dt className="text-slate-400">{k}</dt>
            <dd className="whitespace-pre-line break-words text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-500">الأوقات بتوقيت المنظمة ({timeZone}). لا تملك صلاحية تعديل هذا الحدث.</p>
    </div>
  );
}

function EventForm({
  draft,
  timeZone,
  items,
  editableProjects,
  canCreateOrgEvents,
  onSaved,
  onDeleted,
  close,
}: Props & { close: () => void }) {
  const [allDay, setAllDay] = useState(draft.allDay);
  const [start, setStart] = useState(draft.start);
  const [end, setEnd] = useState(draft.end);
  const [projectId, setProjectId] = useState(draft.projectId);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string>();

  const [state, formAction, saving] = useActionState<EventActionState, FormData>(async (prev, formData) => {
    const result = await saveCalendarEvent(prev, formData);
    if (result.ok) {
      onSaved(result);
      close();
    }
    return result;
  }, {});

  const toggleAllDay = (checked: boolean) => {
    setAllDay(checked);
    if (checked) {
      setStart((s) => s.slice(0, 10));
      setEnd((e) => e.slice(0, 10));
    } else {
      setStart((s) => `${s.slice(0, 10)}T09:00`);
      setEnd((e) => `${e.slice(0, 10)}T10:00`);
    }
  };

  // The browser checks the times against the loaded calendar as the user types; the server
  // checks again after saving, which also covers events outside the visible range.
  const startsAt = allDay ? null : zonedInputToUtc(start, timeZone);
  const endsAt = allDay ? null : zonedInputToUtc(end, timeZone);
  const endBeforeStart = allDay
    ? Boolean(start && end && end < start)
    : Boolean(startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt));
  const overlaps = useMemo(
    () => (startsAt && endsAt && !endBeforeStart
      ? findOverlaps({ id: draft.id, projectId: projectId || null, startsAt, endsAt }, items)
      : []),
    [startsAt, endsAt, endBeforeStart, draft.id, projectId, items],
  );

  const remove = () => {
    if (!draft.id || !confirm(`حذف الحدث «${draft.title}»؟`)) return;
    const id = draft.id;
    startDelete(async () => {
      const result = await deleteCalendarEvent(id);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        onDeleted(draft.title);
        close();
      }
    });
  };

  const busy = saving || deleting;
  const error = state.error ?? deleteError;

  return (
    <form action={formAction} className="space-y-4">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      <div>
        <label className="label" htmlFor="ev-title">العنوان</label>
        <input id="ev-title" name="title" required maxLength={TITLE_MAX} defaultValue={draft.title} data-autofocus className="field" placeholder="مثال: اجتماع تنسيق مع العميل" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ev-kind">النوع</label>
          <select id="ev-kind" name="kind" defaultValue={draft.kind} className="field">
            {EVENT_KINDS.map((k) => <option key={k} value={k}>{EVENT_KIND_LABEL[k]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ev-project">المشروع</label>
          <select id="ev-project" name="project_id" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field">
            {canCreateOrgEvents && <option value="">على مستوى المنظمة</option>}
            {editableProjects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input type="checkbox" name="all_day" checked={allDay} onChange={(e) => toggleAllDay(e.target.checked)} className="accent-emerald-500" />
        طوال اليوم
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ev-start">البداية</label>
          <input
            id="ev-start"
            name="start"
            type={allDay ? "date" : "datetime-local"}
            required
            value={start}
            onChange={(e) => {
              const next = e.target.value;
              setEnd((prevEnd) => moveEndWithStart(start, prevEnd, next));
              setStart(next);
            }}
            className="field"
            dir="ltr"
          />
        </div>
        <div>
          <label className="label" htmlFor="ev-end">النهاية</label>
          <input
            id="ev-end"
            name="end"
            type={allDay ? "date" : "datetime-local"}
            required
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            aria-invalid={endBeforeStart || undefined}
            aria-describedby={endBeforeStart ? "ev-end-error" : undefined}
            className="field"
            dir="ltr"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">الأوقات بتوقيت المنظمة ({timeZone}).</p>
      {endBeforeStart && <p id="ev-end-error" className="text-sm text-red-400" role="alert">يجب ألا تسبق النهاية البداية.</p>}

      <div role="status" aria-live="polite">
        {overlaps.length > 0 && (
          <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-100" data-testid="overlap-warning">
            <p className="flex items-center gap-2 font-medium">
              <TriangleAlert size={16} className="shrink-0 text-amber-300" aria-hidden />
              تنبيه تداخل: يتداخل هذا الموعد مع {overlaps.length === 1 ? "حدث آخر" : `${overlaps.length} أحداث أخرى`}
              {projectId ? " في المشروع نفسه" : " على مستوى المنظمة"}.
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 ps-5 text-xs text-amber-200">
              {overlaps.map((o) => (
                <li key={feedItemKey(o)}>
                  <bdi>{o.title}</bdi> (<bdi dir="rtl">{describeWhen(o, timeZone, { withDate: true })}</bdi>)
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-amber-200/70">هذا تنبيه للمساعدة في الجدولة فقط، ويمكنك الحفظ.</p>
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="ev-location">الموقع (اختياري)</label>
        <input id="ev-location" name="location" maxLength={LOCATION_MAX} defaultValue={draft.location} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="ev-description">الوصف (اختياري)</label>
        <textarea id="ev-description" name="description" rows={3} maxLength={DESCRIPTION_MAX} defaultValue={draft.description} className="field" />
      </div>

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary" disabled={busy || endBeforeStart}>
          <Save size={15} aria-hidden /> {saving ? "جارٍ الحفظ…" : "حفظ الحدث"}
        </button>
        <button type="button" className="btn-ghost" onClick={close} disabled={busy}>إلغاء</button>
        {draft.id && (
          <button type="button" className="btn-danger ms-auto" onClick={remove} disabled={busy}>
            <Trash2 size={15} aria-hidden /> {deleting ? "جارٍ الحذف…" : "حذف"}
          </button>
        )}
      </div>
    </form>
  );
}
