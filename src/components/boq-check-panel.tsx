"use client";

import { useId, useMemo, useState, type MouseEvent } from "react";
import { AlertTriangle, ChevronDown, CircleCheck, ClipboardCheck, Info, OctagonAlert, Tags } from "lucide-react";
import { SEVERITY_ORDER, checkBoq, type BoqLine, type Severity } from "@/lib/boq-check";

/** Every severity has a text label next to its icon and colour, never colour alone. */
const SEVERITY: Record<Severity, { one: string; many: string; Icon: typeof Info; chip: string; icon: string }> = {
  critical: { one: "حرجة", many: "حرجة", Icon: OctagonAlert, chip: "border-red-900 bg-red-950/60 text-red-200", icon: "text-red-400" },
  warning: { one: "تحذير", many: "تحذيرات", Icon: AlertTriangle, chip: "border-amber-900 bg-amber-950/40 text-amber-200", icon: "text-amber-400" },
  info: { one: "معلومة", many: "معلومات", Icon: Info, chip: "border-sky-900 bg-sky-950/40 text-sky-200", icon: "text-sky-400" },
};

/** Added to a row while a finding has moved focus to it (written out here so Tailwind generates them). */
const ROW_FOCUS = ["outline", "outline-2", "-outline-offset-2", "outline-emerald-400", "bg-emerald-500/10"];

/** Moves focus to the finding's row: scrolled into view and highlighted until focus leaves it. */
function jumpToRow(event: MouseEvent<HTMLAnchorElement>, id: string) {
  // Opening the link in a new tab keeps the browser's behaviour.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const row = document.getElementById(id);
  if (!row) return;
  event.preventDefault();
  const madeFocusable = !row.hasAttribute("tabindex");
  if (madeFocusable) row.setAttribute("tabindex", "-1");
  row.classList.add(...ROW_FOCUS);
  row.addEventListener(
    "blur",
    () => {
      row.classList.remove(...ROW_FOCUS);
      if (madeFocusable) row.removeAttribute("tabindex");
    },
    { once: true },
  );
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  row.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  row.focus({ preventScroll: true });
}

const shorten = (text: string, max = 60) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/**
 * The rule-based BOQ checker (src/lib/boq-check.ts) above a bill of quantities: severity counts,
 * findings that link to their rows, and suggested procurement categories. It only reports.
 * Give each table row the id `${anchorPrefix}${line.id}`.
 */
export function BoqCheckPanel({
  lines,
  finance,
  anchorPrefix,
  headingLevel = 3,
}: {
  lines: readonly BoqLine[];
  /** finance_access: cost-based checks run, and lines should carry `unit_cost`. */
  finance: boolean;
  anchorPrefix: string;
  headingLevel?: 2 | 3 | 4;
}) {
  const { findings, summary, categories } = useMemo(() => checkBoq(lines, { finance }), [lines, finance]);
  // Closed unless something is critical; the counts stay visible either way.
  const [open, setOpen] = useState(summary.critical > 0);
  const id = useId();

  if (lines.length === 0) return null;

  const headingId = `${id}-heading`;
  const bodyId = `${id}-body`;
  const Heading = `h${headingLevel}` as const;
  const SubHeading = `h${headingLevel + 1}` as "h3" | "h4" | "h5";
  const total = findings.length;
  const uncategorised = summary.linesChecked - categories.reduce((n, c) => n + c.lineIds.length, 0);

  return (
    <section
      aria-labelledby={headingId}
      className="mb-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 sm:p-4"
      data-testid="boq-check"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Heading id={headingId} className="text-sm font-semibold text-white">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md py-1 text-start hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <ClipboardCheck size={16} aria-hidden className="shrink-0 text-emerald-400" />
            فحص جدول الكميات
            <ChevronDown size={15} aria-hidden className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </Heading>
        {total > 0 && (
          <ul aria-label="عدد الملاحظات حسب الأهمية" className="flex flex-wrap gap-1.5">
            {SEVERITY_ORDER.map((severity) => {
              const { many, Icon, chip } = SEVERITY[severity];
              const count = summary[severity];
              return (
                <li
                  key={severity}
                  data-testid={`boq-check-count-${severity}`}
                  data-count={count}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${count ? chip : "border-slate-800 text-slate-500"}`}
                >
                  <Icon size={12} aria-hidden className="shrink-0" />
                  {many}
                  <span className="font-semibold tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Announced when the counts change, e.g. after a line is fixed. */}
      <p
        aria-live="polite"
        aria-atomic="true"
        data-testid="boq-check-summary"
        className={total ? "sr-only" : "mt-1 flex items-center gap-1.5 text-sm text-emerald-300"}
      >
        {total ? (
          `نتيجة فحص جدول الكميات: حرجة ${summary.critical}، تحذيرات ${summary.warning}، معلومات ${summary.info}، من ${summary.linesChecked} بند.`
        ) : (
          <>
            <CircleCheck size={15} aria-hidden className="shrink-0" />
            لا ملاحظات على جدول الكميات
          </>
        )}
      </p>

      <div id={bodyId} hidden={!open} className="mt-3 space-y-4 border-t border-slate-800 pt-3">
        <p className="text-xs text-slate-500">
          فحص آلي بالقواعد قبل التسعير والإرسال: يشير إلى المشكلات ولا يغيّر أي بيانات. اختر ملاحظة للانتقال إلى بندها.
        </p>

        {total > 0 && (
          <div>
            <SubHeading className="mb-1 text-xs font-semibold text-slate-300">الملاحظات</SubHeading>
            <ul className="max-h-80 space-y-0.5 overflow-y-auto" data-testid="boq-check-findings">
              {findings.map((f) => {
                const { one, Icon, icon } = SEVERITY[f.severity];
                const target = `${anchorPrefix}${f.lineId}`;
                return (
                  <li key={`${f.code}:${f.lineId}`} data-code={f.code} data-severity={f.severity} data-line={f.line}>
                    <a
                      href={`#${target}`}
                      onClick={(e) => jumpToRow(e, target)}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <Icon size={15} aria-hidden className={`mt-0.5 shrink-0 ${icon}`} />
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                        <span className="block text-xs text-slate-400">
                          <span className="sr-only">{one}: </span>
                          البند {f.line} · <bdi>{shorten(lines[f.line - 1]?.description ?? "")}</bdi>
                        </span>
                        <span className="block text-sm text-slate-200">{f.message}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {categories.length > 0 && (
          <div>
            <SubHeading className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Tags size={13} aria-hidden className="shrink-0 text-emerald-400" />
              التصنيفات المقترحة
            </SubHeading>
            <p className="mb-2 text-[11px] text-slate-500">تجميع آلي حسب كلمات الوصف، يساعد في إعداد طلب تسعير لكل فئة من الموردين.</p>
            <ul className="flex flex-wrap gap-1.5" data-testid="boq-check-categories">
              {categories.map((c) => (
                <li
                  key={c.category}
                  data-category={c.category}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                >
                  {c.category}
                  <span className="rounded bg-slate-800 px-1.5 text-[11px] font-semibold tabular-nums text-slate-300">
                    <span className="sr-only">عدد البنود: </span>
                    {c.lineIds.length}
                  </span>
                </li>
              ))}
              {uncategorised > 0 && (
                <li className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-800 px-2 py-1 text-xs text-slate-400">
                  بلا تصنيف
                  <span className="rounded bg-slate-800 px-1.5 text-[11px] font-semibold tabular-nums">
                    <span className="sr-only">عدد البنود: </span>
                    {uncategorised}
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
