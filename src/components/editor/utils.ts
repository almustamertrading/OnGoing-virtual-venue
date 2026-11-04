import area from "@turf/area";
import length from "@turf/length";
import type { FeatureGeometry } from "@/lib/types";

const PALETTE = ["#f97316", "#06b6d4", "#e879f9", "#84cc16", "#facc15", "#38bdf8", "#fb7185", "#a78bfa"];

export function colorForUser(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(email: string) {
  const name = email.split("@")[0] ?? "?";
  const parts = name.split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function measure(geometry: FeatureGeometry) {
  const feature = { type: "Feature" as const, properties: {}, geometry };
  if (geometry.type === "Polygon") {
    const m2 = area(feature);
    return m2 >= 10000 ? `${(m2 / 10000).toFixed(2)} ha (${Math.round(m2).toLocaleString()} m²)` : `${Math.round(m2).toLocaleString()} m²`;
  }
  if (geometry.type === "LineString") {
    const km = length(feature, { units: "kilometers" });
    return km >= 1 ? `${km.toFixed(2)} km` : `${Math.round(km * 1000).toLocaleString()} m`;
  }
  const [lng, lat] = geometry.coordinates;
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}
