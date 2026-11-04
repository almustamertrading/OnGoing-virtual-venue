"use client";

import dynamic from "next/dynamic";

// MapLibre, Terra Draw and the 360° viewer need the browser, so skip server rendering.
export const EditorLoader = dynamic(() => import("./venue-editor").then((m) => m.VenueEditor), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center text-sm text-slate-500">Loading map planner…</div>
  ),
});
