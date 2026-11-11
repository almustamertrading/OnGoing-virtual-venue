"use client";

import { Trash2, X } from "lucide-react";
import type { FeatureRow } from "@/lib/types";
import { colorForUser, measure, timeAgo } from "./utils";
import type { VenueData } from "./use-venue-data";

export function FeaturePanel({
  feature,
  data,
  canEdit,
  userId,
  onClose,
}: {
  feature: FeatureRow;
  data: VenueData;
  canEdit: boolean;
  userId: string;
  onClose: () => void;
}) {
  const kind = feature.geometry.type === "Polygon" ? "Area" : feature.geometry.type === "LineString" ? "Line" : "Point";
  const viewers = data.online.filter((u) => u.selected === feature.id && u.user_id !== userId);
  const editor = data.profiles[feature.updated_by ?? feature.created_by]?.email;

  return (
    <div className="w-full space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4 md:w-72 md:shadow-2xl" data-testid="feature-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">{kind}</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-100" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      {viewers.length > 0 && (
        <p className="flex flex-wrap items-center gap-1 text-xs text-amber-300">
          Also looking at this:
          {viewers.map((v) => (
            <span key={v.user_id} className="rounded px-1.5 py-0.5 text-slate-950" style={{ background: colorForUser(v.user_id) }}>
              {v.email.split("@")[0]}
            </span>
          ))}
        </p>
      )}
      <div>
        <label className="label" htmlFor="feature-name">Name</label>
        <input
          id="feature-name"
          key={`name-${feature.id}-${feature.name}`}
          defaultValue={feature.name}
          disabled={!canEdit}
          placeholder="e.g. Gate C security check"
          onBlur={(e) => {
            if (e.target.value !== feature.name) data.updateFeature(feature.id, { name: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="feature-layer">Layer</label>
        <select
          id="feature-layer"
          value={feature.layer_id}
          disabled={!canEdit}
          onChange={(e) => data.updateFeature(feature.id, { layer_id: e.target.value })}
          className="field"
        >
          {data.layers.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="feature-notes">Notes</label>
        <textarea
          id="feature-notes"
          key={`notes-${feature.id}-${feature.notes}`}
          defaultValue={feature.notes}
          disabled={!canEdit}
          rows={3}
          placeholder="Capacity, supplier, opening times…"
          onBlur={(e) => {
            if (e.target.value !== feature.notes) data.updateFeature(feature.id, { notes: e.target.value });
          }}
          className="field"
        />
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">{kind === "Area" ? "Size" : kind === "Line" ? "Length" : "Position"}</dt>
          <dd className="text-right text-slate-200" data-testid="feature-measure">{measure(feature.geometry)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Last edit</dt>
          <dd className="truncate text-right text-slate-300">
            {editor ? `${editor.split("@")[0]}, ` : ""}{timeAgo(feature.updated_at)}
          </dd>
        </div>
      </dl>
      {canEdit && (
        <>
          <p className="text-xs text-slate-500">
            Drag the shape to move it. Drag a corner to reshape it, or a green midpoint to add a corner.
          </p>
          <button
            type="button"
            className="btn-danger w-full"
            onClick={() => {
              if (confirm("Delete this shape?")) {
                data.deleteFeature(feature.id);
                onClose();
              }
            }}
          >
            <Trash2 size={14} /> Delete shape
          </button>
        </>
      )}
    </div>
  );
}
