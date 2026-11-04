"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronLeft,
  Circle,
  Layers,
  MapPin,
  MessageSquare,
  MousePointer2,
  Pentagon,
  RectangleHorizontal,
  Spline,
  PanelLeftClose,
  PanelLeftOpen,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { Basemap } from "@/lib/map-style";
import type { CommentRow, FeatureRow, MemberRole, PanoramaRow, VenueRow } from "@/lib/types";
import { MapCanvas, type Tool } from "./map-canvas";
import { useVenueData } from "./use-venue-data";
import { LayersPanel } from "./layers-panel";
import { FeaturePanel } from "./feature-panel";
import { CommentsPanel } from "./comments-panel";
import { PanoramasPanel } from "./panoramas-panel";
import { PanoramaUpload } from "./panorama-upload";
import { PanoramaViewer } from "./panorama-viewer";
import { colorForUser, initials } from "./utils";

type Props = {
  projectId: string;
  projectName: string;
  venue: VenueRow;
  role: MemberRole;
  userId: string;
  email: string;
};

const TOOLS: { id: Tool; label: string; icon: React.ReactNode; edit: boolean }[] = [
  { id: "select", label: "Select and edit", icon: <MousePointer2 size={18} />, edit: false },
  { id: "polygon", label: "Draw area", icon: <Pentagon size={18} />, edit: true },
  { id: "rectangle", label: "Draw rectangle", icon: <RectangleHorizontal size={18} />, edit: true },
  { id: "circle", label: "Draw circle", icon: <Circle size={18} />, edit: true },
  { id: "linestring", label: "Draw line or route", icon: <Spline size={18} />, edit: true },
  { id: "point", label: "Drop a point", icon: <MapPin size={18} />, edit: true },
  { id: "comment", label: "Pin a comment", icon: <MessageSquare size={18} />, edit: false },
  { id: "panorama", label: "Add a 360° photo", icon: <Camera size={18} />, edit: true },
];

const HINTS: Partial<Record<Tool, string>> = {
  polygon: "Tap to add corners. Tap the first corner to close the area.",
  rectangle: "Tap one corner, then the opposite corner.",
  circle: "Tap the centre, then tap again to set the radius.",
  linestring: "Tap to add points. Tap the last point again to finish.",
  point: "Tap the map to drop a point.",
  comment: "Tap the map where the comment belongs.",
  panorama: "Tap the map where the 360° photo was taken.",
};

type Tab = "layers" | "comments" | "photos";

export function VenueEditor({ projectId, projectName, venue, role, userId, email }: Props) {
  const canEdit = role === "owner" || role === "editor";
  const data = useVenueData({ projectId, venueId: venue.id, userId, email });

  const [tool, setTool] = useState<Tool>("select");
  const [tab, setTab] = useState<Tab>("layers");
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [chosenLayerId, setActiveLayerId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [chosenSelectedId, setSelectedId] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState<{ lng: number; lat: number; x: number; y: number } | null>(null);
  const [draftText, setDraftText] = useState("");
  const [panoDraft, setPanoDraft] = useState<{ lng: number; lat: number } | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; key: number } | null>(null);
  // The side panel starts open on tablets and desktops, closed on phones.
  const [panelOpen, setPanelOpen] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  const closePanelOnPhone = useCallback(() => {
    if (!window.matchMedia("(min-width: 768px)").matches) setPanelOpen(false);
  }, []);

  const layerById = useMemo(() => new Map(data.layers.map((l) => [l.id, l])), [data.layers]);
  // The active drawing layer falls back to the first layer.
  const activeLayerId =
    chosenLayerId && layerById.has(chosenLayerId) ? chosenLayerId : (data.layers[0]?.id ?? null);
  const activeLayer = activeLayerId ? layerById.get(activeLayerId) ?? null : null;

  const visibleFeatures = useMemo(
    () =>
      data.features
        .filter((f) => layerById.has(f.layer_id) && !hidden.has(f.layer_id))
        .map((f) => ({ ...f, color: layerById.get(f.layer_id)!.color })),
    [data.features, layerById, hidden],
  );
  // The selection is dropped if the shape disappears (deleted remotely or hidden).
  const selectedId =
    chosenSelectedId && visibleFeatures.some((f) => f.id === chosenSelectedId) ? chosenSelectedId : null;
  const selected = selectedId ? data.features.find((f) => f.id === selectedId) ?? null : null;

  const { trackSelection } = data;
  useEffect(() => {
    trackSelection(selectedId);
  }, [selectedId, trackSelection]);

  const chooseTool = useCallback((t: Tool) => {
    setTool(t);
    setDraftComment(null);
    if (t !== "select") setSelectedId(null);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      if (e.key === "Escape") {
        chooseTool("select");
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chooseTool]);

  const onCreate = useCallback(
    (input: { id: string; geometry: FeatureRow["geometry"]; mode: string }) => {
      if (!activeLayer) {
        data.report("Add a layer first, then draw.");
        return null;
      }
      data.createFeature({ ...input, layerId: activeLayer.id });
      // Select the new shape so it can be named straight away.
      setTool("select");
      setSelectedId(input.id);
      return { layerId: activeLayer.id, color: activeLayer.color };
    },
    [activeLayer, data],
  );

  const openComment = useCallback(
    (c: CommentRow) => {
      setTab("comments");
      setActiveCommentId(c.id);
      setPanelOpen(true);
      if (c.lng != null && c.lat != null) setFlyTo({ lng: c.lng, lat: c.lat, key: Date.now() });
    },
    [],
  );

  const openPanorama = useCallback(
    (p: PanoramaRow) => setViewerIndex(data.panoramas.findIndex((x) => x.id === p.id)),
    [data.panoramas],
  );

  const others = data.online.filter((u) => u.user_id !== userId);
  const openComments = data.comments.filter((c) => !c.parent_id && !c.resolved).length;

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950 px-3">
        <Link href={`/projects/${projectId}/venues`} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white">
          <ChevronLeft size={16} /> <span className="hidden max-w-40 truncate sm:inline">{projectName}</span>
        </Link>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-label={panelOpen ? "Hide side panel" : "Show side panel"}
          aria-expanded={panelOpen}
          className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800"
        >
          {panelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <h1 className="min-w-0 truncate text-sm font-semibold text-white">{venue.name}</h1>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-300">{role}</span>
        <div className="flex-1" />
        <div className="flex items-center -space-x-1.5" data-testid="presence">
          {others.map((u) => (
            <span
              key={u.user_id}
              title={`${u.email} is here`}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-950 text-[10px] font-bold text-slate-950"
              style={{ background: colorForUser(u.user_id) }}
            >
              {initials(u.email)}
            </span>
          ))}
        </div>
        <span
          className={`flex items-center gap-1 text-xs ${data.connected ? "text-emerald-400" : "text-slate-500"}`}
          title={data.connected ? "Live: changes sync instantly" : "Connecting…"}
        >
          {data.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="hidden md:inline">{data.connected ? `Live${others.length ? ` · ${others.length + 1} here` : ""}` : "Connecting"}</span>
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className={`${panelOpen ? "flex" : "hidden"} absolute inset-y-0 left-0 z-30 w-72 max-w-[85vw] shrink-0 flex-col border-r border-slate-800 bg-slate-950 shadow-2xl md:static md:z-10 md:shadow-none`}
          data-testid="side-panel"
        >
          <nav className="grid grid-cols-3 border-b border-slate-800 text-xs">
            {(
              [
                ["layers", "Layers", <Layers key="l" size={14} />],
                ["comments", `Comments${openComments ? ` (${openComments})` : ""}`, <MessageSquare key="c" size={14} />],
                ["photos", `360° (${data.panoramas.length})`, <Camera key="p" size={14} />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center justify-center gap-1 py-2.5 ${tab === id ? "border-b-2 border-emerald-500 text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                {icon} {label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {data.loading ? (
              <p className="text-sm text-slate-500">Loading plan…</p>
            ) : tab === "layers" ? (
              <LayersPanel
                data={data}
                canEdit={canEdit}
                activeLayerId={activeLayerId}
                setActiveLayerId={setActiveLayerId}
                hidden={hidden}
                toggleHidden={(id) =>
                  setHidden((h) => {
                    const next = new Set(h);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                selectedId={selectedId}
                onSelectFeature={(f) => {
                  setTool("select");
                  setHidden((h) => {
                    if (!h.has(f.layer_id)) return h;
                    const next = new Set(h);
                    next.delete(f.layer_id);
                    return next;
                  });
                  setSelectedId(f.id);
                  closePanelOnPhone();
                  const c = f.geometry.type === "Point" ? f.geometry.coordinates : null;
                  if (c) setFlyTo({ lng: c[0], lat: c[1], key: Date.now() });
                }}
              />
            ) : tab === "comments" ? (
              <CommentsPanel
                data={data}
                userId={userId}
                canEdit={canEdit}
                activeId={activeCommentId}
                onOpen={openComment}
              />
            ) : (
              <PanoramasPanel data={data} canEdit={canEdit} onOpen={openPanorama} />
            )}
          </div>
        </aside>

        {/* Map */}
        <div className="relative min-w-0 flex-1">
          <MapCanvas
            venue={venue}
            basemap={basemap}
            tool={tool}
            canEdit={canEdit}
            features={visibleFeatures}
            selectedId={selectedId}
            comments={data.comments}
            panoramas={data.panoramas}
            activeCommentId={activeCommentId}
            flyTo={flyTo}
            activeColor={activeLayer?.color ?? null}
            onCreate={onCreate}
            onGeometryChange={(id, geometry) => data.updateFeature(id, { geometry })}
            onSelect={setSelectedId}
            onMapClick={(ll, pt) => {
              if (tool === "comment") {
                setDraftText("");
                setDraftComment({ ...ll, ...pt });
              } else if (tool === "panorama" && canEdit) {
                setPanoDraft(ll);
              }
            }}
            onOpenComment={(id) => {
              const c = data.comments.find((x) => x.id === id);
              if (c) openComment(c);
            }}
            onOpenPanorama={(id) => {
              const p = data.panoramas.find((x) => x.id === id);
              if (p) openPanorama(p);
            }}
          />

          {/* Toolbar */}
          <div className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/95 p-1 shadow-xl" role="toolbar" aria-label="Map tools">
            {TOOLS.filter((t) => canEdit || !t.edit).map((t, i, arr) => (
              <span key={t.id} className="flex items-center">
                {i > 0 && arr[i - 1].edit !== t.edit && t.id === "comment" && <span className="mx-1 h-6 w-px bg-slate-700" />}
                <button
                  type="button"
                  title={t.label}
                  aria-label={t.label}
                  aria-pressed={tool === t.id}
                  onClick={() => chooseTool(t.id)}
                  className={`rounded-lg p-2 ${tool === t.id ? "bg-emerald-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
                >
                  {t.icon}
                </button>
              </span>
            ))}
          </div>

          {/* Drawing hint */}
          {HINTS[tool] && (
            <div className="pointer-events-none absolute left-1/2 top-16 z-10 w-max max-w-[90%] -translate-x-1/2 rounded-lg bg-slate-950/90 px-3 py-1.5 text-center text-xs text-slate-200 shadow" data-testid="tool-hint">
              {HINTS[tool]}
              {canEdit && ["polygon", "rectangle", "circle", "linestring", "point"].includes(tool) && activeLayer && (
                <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
                  into <span className="h-2 w-2 rounded-sm" style={{ background: activeLayer.color }} /> {activeLayer.name}
                </span>
              )}
            </div>
          )}

          {/* Basemap switch */}
          <div className="absolute bottom-10 left-3 z-10 flex overflow-hidden rounded-lg border border-slate-700 text-xs shadow">
            {(["satellite", "streets"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBasemap(b)}
                className={`px-3 py-1.5 capitalize ${basemap === b ? "bg-emerald-500 text-slate-950" : "bg-slate-950/90 text-slate-300 hover:bg-slate-800"}`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Selected shape */}
          {selected && (
            <div className="absolute inset-x-2 bottom-2 z-20 max-h-[55dvh] overflow-y-auto rounded-xl md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:max-h-[calc(100%-1.5rem)]">
              <FeaturePanel
                feature={selected}
                data={data}
                canEdit={canEdit}
                userId={userId}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}

          {/* New comment composer */}
          {draftComment && (
            <form
              className="card absolute z-20 w-64 space-y-2 bg-slate-900 p-3 shadow-2xl"
              style={{
                left: Math.max(8, draftComment.x - 128),
                top: Math.max(8, draftComment.y + 12),
              }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!draftText.trim()) return;
                const c = await data.addComment({ body: draftText.trim(), lng: draftComment.lng, lat: draftComment.lat });
                if (c) {
                  setDraftComment(null);
                  setTab("comments");
                  setActiveCommentId(c.id);
                  setTool("select");
                }
              }}
            >
              <textarea
                autoFocus
                rows={3}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="What needs attention here?"
                className="field"
                aria-label="Comment"
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost py-1 text-xs" onClick={() => setDraftComment(null)}>Cancel</button>
                <button className="btn-primary py-1 text-xs" disabled={!draftText.trim()}>Post</button>
              </div>
            </form>
          )}

          {/* Errors */}
          {data.error && (
            <div role="alert" className="absolute bottom-10 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-red-900 bg-red-950/95 px-4 py-2 text-sm text-red-200 shadow-xl">
              {data.error}
            </div>
          )}
        </div>
      </div>

      {panoDraft && (
        <PanoramaUpload
          at={panoDraft}
          onCancel={() => {
            setPanoDraft(null);
            setTool("select");
          }}
          onUpload={async ({ file, title }) => {
            const row = await data.uploadPanorama({ file, title, ...panoDraft });
            if (row) setTab("photos");
            return Boolean(row);
          }}
        />
      )}

      {viewerIndex !== null && viewerIndex >= 0 && data.panoramas[viewerIndex] && (
        <PanoramaViewer
          panoramas={data.panoramas}
          index={viewerIndex}
          setIndex={setViewerIndex}
          getUrl={data.panoramaUrl}
          onClose={() => setViewerIndex(null)}
          onShowOnMap={(p) => {
            setViewerIndex(null);
            setFlyTo({ lng: p.lng, lat: p.lat, key: Date.now() });
          }}
        />
      )}
    </div>
  );
}
