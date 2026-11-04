"use client";

import { Camera, Trash2 } from "lucide-react";
import type { PanoramaRow } from "@/lib/types";
import { timeAgo } from "./utils";
import type { VenueData } from "./use-venue-data";

export function PanoramasPanel({
  data,
  canEdit,
  onOpen,
}: {
  data: VenueData;
  canEdit: boolean;
  onOpen: (p: PanoramaRow) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 text-xs text-slate-500">
        <Camera size={14} className="mt-0.5 shrink-0" />
        {canEdit
          ? "Pick the 360° tool, tap where the photo was taken, then upload a 360° photo from a 360 camera or your phone's panorama mode."
          : "Tap a blue camera pin or a photo below to look around."}
      </p>
      {data.panoramas.length === 0 && <p className="text-sm text-slate-500">No 360° photos yet.</p>}
      <ul className="space-y-1.5">
        {data.panoramas.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2">
            <button type="button" onClick={() => onOpen(p)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm text-slate-100">{p.title}</p>
              <p className="text-xs text-slate-500">{timeAgo(p.created_at)}</p>
            </button>
            {canEdit && (
              <button
                type="button"
                aria-label={`Delete ${p.title}`}
                onClick={() => confirm(`Delete "${p.title}"?`) && data.deletePanorama(p)}
                className="text-slate-500 hover:text-red-400"
              >
                <Trash2 size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
