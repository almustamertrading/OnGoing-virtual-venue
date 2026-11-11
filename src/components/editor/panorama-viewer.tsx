"use client";

import { useEffect, useRef, useState } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import type { PanoramaRow } from "@/lib/types";

export function PanoramaViewer({
  panoramas,
  index,
  setIndex,
  getUrl,
  onClose,
  onShowOnMap,
}: {
  panoramas: PanoramaRow[];
  index: number;
  setIndex: (i: number) => void;
  getUrl: (p: PanoramaRow) => Promise<string | null>;
  onClose: () => void;
  onShowOnMap: (p: PanoramaRow) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const pano = panoramas[index];
  // Load result for a given photo id; anything else means it is still loading.
  const [result, setResult] = useState<{ id: string; ok: boolean } | null>(null);
  const loading = result?.id !== pano?.id;
  const failed = !loading && result?.ok === false;

  useEffect(() => {
    if (!el.current) return;
    viewer.current = new Viewer({
      container: el.current,
      navbar: ["zoom", "move", "fullscreen"],
      defaultZoomLvl: 0,
      touchmoveTwoFingers: false,
      mousewheelCtrlKey: false,
    });
    return () => {
      viewer.current?.destroy();
      viewer.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!pano) return;
    getUrl(pano).then(async (url) => {
      if (cancelled || !viewer.current) return;
      let ok = Boolean(url);
      if (url) {
        try {
          await viewer.current.setPanorama(url, { transition: false, showLoader: true });
        } catch {
          ok = false;
        }
      }
      if (!cancelled) setResult({ id: pano.id, ok });
    });
    return () => {
      cancelled = true;
    };
  }, [pano, getUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && panoramas.length > 1) setIndex((index + 1) % panoramas.length);
      if (e.key === "ArrowLeft" && panoramas.length > 1) setIndex((index - 1 + panoramas.length) % panoramas.length);
    }
    // Capture phase: the 360° viewer handles keys itself and stops them bubbling.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, panoramas.length, setIndex, onClose]);

  if (!pano) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" data-testid="panorama-viewer">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950 px-3">
        <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-100">360°</span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{pano.title}</p>
        <span className="text-xs text-slate-500">{index + 1} / {panoramas.length}</span>
        <button type="button" className="btn-ghost py-1 text-xs" onClick={() => onShowOnMap(pano)}>
          <MapPin size={14} /> Show on map
        </button>
        <button type="button" onClick={onClose} aria-label="Close viewer" className="text-slate-300 hover:text-slate-100">
          <X size={20} />
        </button>
      </div>
      <div className="relative flex-1">
        <div className="absolute inset-0">
          <div ref={el} className="h-full w-full" />
        </div>
        {failed && !loading && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-red-300">
            This photo could not be loaded.
          </p>
        )}
        {panoramas.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => setIndex((index - 1 + panoramas.length) % panoramas.length)}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-slate-100 hover:bg-black/80"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => setIndex((index + 1) % panoramas.length)}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-slate-100 hover:bg-black/80"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
