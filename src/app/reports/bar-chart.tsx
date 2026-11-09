"use client";

import { useCallback, useState } from "react";
import { CHART_COLORS, barPathRtl, barScale } from "@/lib/reports";

export type BarDatum = {
  key: string;
  label: string;
  value: number;
  /** Short value drawn at the bar's tip, e.g. "SAR 500K". */
  display: string;
  /** Full value for the tooltip and the text equivalent, e.g. "SAR 500,000". */
  full: string;
};

const ROW = 30;
const THICKNESS = 14; // thin marks: well under the 24px cap
const PAD_Y = 4;
const VALUE_SPACE = 72;
/** Width rendered on the server and before the first measurement. */
const DEFAULT_WIDTH = 360;

/**
 * Horizontal bar chart in inline SVG, laid out right to left. The viewBox follows the measured
 * width of its container, so text stays at its real size on a phone and on a desktop, and the
 * height never changes (no layout shift). Every bar is labelled at its tip, the SVG has a text
 * equivalent (role="img" + aria-label + <title>), and the section's table holds the same data.
 */
export function BarChart({ title, data }: { title: string; data: BarDatum[] }) {
  const [measured, setMeasured] = useState<number | null>(null);
  // React 19 ref callbacks may return a cleanup: observe the container while it is mounted.
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width > 0) setMeasured(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const width = measured ?? DEFAULT_WIDTH;
  const height = data.length * ROW + PAD_Y * 2;
  const labelWidth = Math.min(132, Math.max(84, Math.round(width * 0.3)));
  const baseline = width - labelWidth - 8;
  const lengths = barScale(data.map((d) => d.value), baseline - VALUE_SPACE);
  const description = `${title}: ${data.map((d) => `${d.label} ${d.full}`).join("، ")}`;

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-xs font-medium text-slate-400">{title}</figcaption>
      <div ref={measure} className="w-full">
        <svg
          role="img"
          aria-label={description}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="xMaxYMid meet"
          direction="rtl"
          className="block"
        >
          <title>{description}</title>
          {data.map((d, i) => {
            const top = PAD_Y + i * ROW;
            const middle = top + ROW / 2;
            const length = lengths[i] ?? 0;
            return (
              <g key={d.key} className="group">
                <title>{`${d.label}: ${d.full}`}</title>
                {/* Hover target: the whole row, not just the painted bar. */}
                <rect x={0} y={top} width={width} height={ROW} fill="transparent" />
                <text x={width} y={middle} dy="0.35em" textAnchor="start" className="fill-slate-300 text-xs">
                  {d.label}
                </text>
                {length > 0 && (
                  <path
                    d={barPathRtl(baseline, middle - THICKNESS / 2, length, THICKNESS)}
                    fill={CHART_COLORS.bar}
                    className="transition-opacity group-hover:opacity-75"
                  />
                )}
                <text
                  x={baseline - length - 6}
                  y={middle}
                  dy="0.35em"
                  textAnchor="start"
                  className="fill-slate-100 text-[11px] font-semibold tabular-nums"
                >
                  {d.display}
                </text>
              </g>
            );
          })}
          <line
            x1={baseline}
            x2={baseline}
            y1={PAD_Y}
            y2={height - PAD_Y}
            stroke={CHART_COLORS.baseline}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
        </svg>
      </div>
    </figure>
  );
}
