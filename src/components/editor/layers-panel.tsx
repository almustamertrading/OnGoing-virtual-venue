"use client";

import { useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import type { FeatureRow, LayerRow } from "@/lib/types";
import type { VenueData } from "./use-venue-data";

const SWATCHES = ["#ef4444", "#f59e0b", "#eab308", "#10b981", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

export function LayersPanel({
  data,
  canEdit,
  activeLayerId,
  setActiveLayerId,
  hidden,
  toggleHidden,
  selectedId,
  onSelectFeature,
}: {
  data: VenueData;
  canEdit: boolean;
  activeLayerId: string | null;
  setActiveLayerId: (id: string) => void;
  hidden: Set<string>;
  toggleHidden: (id: string) => void;
  selectedId: string | null;
  onSelectFeature: (f: FeatureRow) => void;
}) {
  const [newName, setNewName] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const byLayer = new Map<string, FeatureRow[]>();
  data.features.forEach((f) => byLayer.set(f.layer_id, [...(byLayer.get(f.layer_id) ?? []), f]));

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const layer = await data.createLayer(name, SWATCHES[data.layers.length % SWATCHES.length]);
    if (layer) {
      setActiveLayerId(layer.id);
      setNewName("");
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <p className="text-xs text-slate-500">
          New shapes go into the layer marked <span className="text-emerald-400">Drawing</span>. Tap a layer to make it active.
        </p>
      )}
      <ul className="space-y-1.5">
        {data.layers.map((layer: LayerRow) => {
          const items = byLayer.get(layer.id) ?? [];
          const isActive = layer.id === activeLayerId;
          const isHidden = hidden.has(layer.id);
          return (
            <li
              key={layer.id}
              className={`rounded-lg border ${isActive ? "border-emerald-600 bg-emerald-950/30" : "border-slate-800 bg-slate-900"}`}
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                {canEdit ? (
                  <label className="relative h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded" style={{ background: layer.color }} title="Change colour">
                    <input
                      type="color"
                      value={layer.color}
                      onChange={(e) => data.updateLayer(layer.id, { color: e.target.value })}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      aria-label={`Colour of ${layer.name}`}
                    />
                  </label>
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded" style={{ background: layer.color }} />
                )}
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm text-slate-100"
                  onClick={() => {
                    if (canEdit) setActiveLayerId(layer.id);
                    setExpanded(expanded === layer.id ? null : layer.id);
                  }}
                >
                  {layer.name}
                  <span className="ml-1.5 text-xs text-slate-500">{items.length}</span>
                </button>
                {isActive && canEdit && (
                  <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-950">Drawing</span>
                )}
                <button
                  type="button"
                  onClick={() => toggleHidden(layer.id)}
                  className="text-slate-400 hover:text-white"
                  aria-label={isHidden ? `Show ${layer.name}` : `Hide ${layer.name}`}
                >
                  {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete the layer "${layer.name}" and its ${items.length} shape(s)?`)) data.deleteLayer(layer.id);
                    }}
                    className="text-slate-500 hover:text-red-400"
                    aria-label={`Delete ${layer.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {expanded === layer.id && (
                <div className="border-t border-slate-800 px-2 py-1.5">
                  {canEdit && (
                    <input
                      defaultValue={layer.name}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== layer.name) data.updateLayer(layer.id, { name });
                      }}
                      className="field mb-1.5 py-1 text-xs"
                      aria-label="Layer name"
                    />
                  )}
                  {items.length === 0 ? (
                    <p className="py-1 text-xs text-slate-500">No shapes yet.</p>
                  ) : (
                    <ul className="max-h-48 overflow-y-auto">
                      {items.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => onSelectFeature(f)}
                            className={`block w-full truncate rounded px-1.5 py-1 text-left text-xs ${f.id === selectedId ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}
                          >
                            {f.name || `Unnamed ${f.geometry.type === "Polygon" ? "area" : f.geometry.type === "LineString" ? "line" : "point"}`}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex gap-2"
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New layer name" className="field py-1.5" />
          <button className="btn-ghost px-2" aria-label="Add layer">
            <Plus size={16} />
          </button>
        </form>
      )}
    </div>
  );
}
