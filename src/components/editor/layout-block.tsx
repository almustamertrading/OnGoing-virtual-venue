"use client";

// AutoCAD-style 2D block symbols for layout items. Each symbol is drawn in
// object space centred on (0,0), spanning [-w/2..w/2, -h/2..h/2], with a
// constant (non-scaling) line weight so it reads like CAD line-art at any zoom.
// The item's colour is used as the "layer" line colour, like AutoCAD layers.

const DEFAULT_LINE = "#334155";
const SW = 1.4;
const VNE = "non-scaling-stroke" as const;
const FILL = "#f8fafc";

export function LayoutBlock({ kind, w, h, color }: { kind: string; w: number; h: number; color?: string }) {
  const hw = w / 2;
  const hh = h / 2;
  const S = color || DEFAULT_LINE;
  const base = { stroke: S, strokeWidth: SW, vectorEffect: VNE } as const;
  const ln = (x1: number, y1: number, x2: number, y2: number, k: string, sw = SW) => (
    <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={S} strokeWidth={sw} vectorEffect={VNE} />
  );

  switch (kind) {
    case "table_round":
      return (
        <>
          <ellipse rx={hw} ry={hh} fill={FILL} fillOpacity={0.9} {...base} />
          <ellipse rx={hw * 0.6} ry={hh * 0.6} fill="none" {...base} strokeWidth={1} />
        </>
      );
    case "tree":
      return (
        <>
          <ellipse rx={hw} ry={hh} fill="#ecfdf5" fillOpacity={0.9} {...base} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return ln(Math.cos(a) * hw * 0.6, Math.sin(a) * hh * 0.6, Math.cos(a) * hw, Math.sin(a) * hh, `t${i}`, 1);
          })}
          <circle r={2.5} fill={S} />
        </>
      );
    case "chair":
      return (
        <>
          <rect x={-hw * 0.82} y={-hh * 0.7} width={w * 0.82} height={h * 0.82} rx={3} fill={FILL} fillOpacity={0.95} {...base} />
          {ln(-hw * 0.82, hh * 0.82, hw * 0.82, hh * 0.82, "back", 2.4)}
        </>
      );
    case "sofa":
      return (
        <>
          <rect x={-hw} y={-hh} width={w} height={h} rx={6} fill={FILL} fillOpacity={0.9} {...base} />
          {ln(-hw, hh * 0.3, hw, hh * 0.3, "seat", 1)}
          {ln(-hw * 0.8, -hh, -hw * 0.8, hh, "arm1", 1)}
          {ln(hw * 0.8, -hh, hw * 0.8, hh, "arm2", 1)}
        </>
      );
    case "stage":
    case "podium":
      return (
        <>
          <rect x={-hw} y={-hh} width={w} height={h} rx={2} fill={FILL} fillOpacity={0.9} {...base} />
          {[0.2, 0.4, 0.6, 0.8].map((t, i) => ln(-hw + w * t, -hh, -hw + w * t - h, hh, `d${i}`, 0.8))}
        </>
      );
    case "dancefloor":
      return (
        <>
          <rect x={-hw} y={-hh} width={w} height={h} fill={FILL} fillOpacity={0.9} {...base} />
          {[0.25, 0.5, 0.75].map((t, i) => ln(-hw + w * t, -hh, -hw + w * t, hh, `v${i}`, 0.7))}
          {[0.25, 0.5, 0.75].map((t, i) => ln(-hw, -hh + h * t, hw, -hh + h * t, `hz${i}`, 0.7))}
        </>
      );
    case "bar":
    case "buffet":
    case "catering":
    case "coffee":
      return (
        <>
          <rect x={-hw} y={-hh} width={w} height={h} rx={2} fill={FILL} fillOpacity={0.9} {...base} />
          {ln(-hw, -hh + h * 0.3, hw, -hh + h * 0.3, "counter", 1)}
        </>
      );
    case "screen":
    case "truss":
      return (
        <>
          <rect x={-hw} y={-hh} width={w} height={h} fill={FILL} fillOpacity={0.9} {...base} />
          {ln(-hw, -hh, hw, hh, "x1", 0.8)}
          {ln(-hw, hh, hw, -hh, "x2", 0.8)}
        </>
      );
    case "speaker":
      return (
        <>
          <polygon points={`${-hw},${-hh} ${hw},${-hh * 0.5} ${hw},${hh * 0.5} ${-hw},${hh}`} fill={FILL} fillOpacity={0.9} {...base} />
          <circle cx={hw * 0.2} r={Math.min(hw, hh) * 0.5} fill="none" {...base} strokeWidth={1} />
        </>
      );
    case "dj":
    case "av":
      return (
        <>
          <rect x={-hw} y={-hh} width={w} height={h} rx={2} fill={FILL} fillOpacity={0.9} {...base} />
          <circle cx={-hw * 0.4} r={Math.min(w, h) * 0.22} fill="none" {...base} strokeWidth={1} />
          <circle cx={hw * 0.4} r={Math.min(w, h) * 0.22} fill="none" {...base} strokeWidth={1} />
        </>
      );
    case "entrance":
    case "exit": {
      const up = kind === "entrance";
      const ay = up ? -hh : hh;
      const by = up ? hh : -hh;
      const dir = up ? -1 : 1;
      return (
        <>
          {ln(-hw, by, hw, by, "sill", 2.2)}
          {ln(0, by, 0, ay, "shaft", 1.4)}
          {ln(0, ay, -w * 0.18, ay + dir * h * 0.28, "a1", 1.4)}
          {ln(0, ay, w * 0.18, ay + dir * h * 0.28, "a2", 1.4)}
        </>
      );
    }
    case "barrier":
      return (
        <>
          {ln(-hw, 0, hw, 0, "bar", 2)}
          {Array.from({ length: 5 }, (_, i) => ln(-hw + (w / 4) * i, -hh, -hw + (w / 4) * i, hh, `p${i}`, 1))}
        </>
      );
    case "tent":
    case "pavilion":
      return (
        <>
          <rect x={-hw} y={-hh} width={w} height={h} fill={FILL} fillOpacity={0.85} {...base} />
          {ln(-hw, -hh, 0, 0, "t1", 1)}
          {ln(hw, -hh, 0, 0, "t2", 1)}
          {ln(-hw, hh, 0, 0, "t3", 1)}
          {ln(hw, hh, 0, 0, "t4", 1)}
        </>
      );
    case "booth":
      return (
        <>
          <path d={`M ${-hw} ${hh} L ${-hw} ${-hh} L ${hw} ${-hh} L ${hw} ${hh}`} fill={FILL} fillOpacity={0.9} {...base} />
          {ln(-hw * 0.5, hh, hw * 0.5, hh, "counter", 1.6)}
        </>
      );
    case "restroom":
      return (
        <>
          <rect x={-hw} y={-hh} width={w} height={h} rx={2} fill={FILL} fillOpacity={0.9} {...base} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={Math.min(w, h) * 0.4} fill={S} fontWeight="700" style={{ pointerEvents: "none" }}>WC</text>
        </>
      );
    case "carpet":
    case "zone":
      return (
        <rect x={-hw} y={-hh} width={w} height={h} rx={3} fill={color || "#38bdf8"} fillOpacity={kind === "zone" ? 0.12 : 0.18} stroke={S} strokeWidth={1.2} strokeDasharray="6 4" vectorEffect={VNE} />
      );
    case "photobooth":
      return (
        <>
          <rect x={-hw} y={-hh} width={w} height={h} rx={2} fill={FILL} fillOpacity={0.9} {...base} />
          <circle r={Math.min(w, h) * 0.28} fill="none" {...base} strokeWidth={1} />
        </>
      );
    case "text":
      return null;
    default:
      return <rect x={-hw} y={-hh} width={w} height={h} rx={3} fill={FILL} fillOpacity={0.9} {...base} />;
  }
}
