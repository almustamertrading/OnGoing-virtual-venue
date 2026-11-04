"use client";

import { useEffect, useRef } from "react";
import { maplibregl } from "@/lib/maplibre";
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
  type HexColor,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import centroid from "@turf/centroid";
import { baseStyle, LABEL_FONT, setBasemap, type Basemap } from "@/lib/map-style";
import type { CommentRow, FeatureGeometry, FeatureRow, PanoramaRow, VenueRow } from "@/lib/types";

export type Tool =
  | "select"
  | "polygon"
  | "rectangle"
  | "circle"
  | "linestring"
  | "point"
  | "comment"
  | "panorama";

export const DRAW_TOOLS: Tool[] = ["polygon", "rectangle", "circle", "linestring", "point"];

type Props = {
  venue: VenueRow;
  basemap: Basemap;
  tool: Tool;
  canEdit: boolean;
  /** Features on visible layers, with their layer colour resolved. */
  features: (FeatureRow & { color: string })[];
  selectedId: string | null;
  comments: CommentRow[];
  panoramas: PanoramaRow[];
  activeCommentId: string | null;
  flyTo: { lng: number; lat: number; key: number } | null;
  /** Colour of the layer new shapes go into. */
  activeColor: string | null;
  /** Saves a drawn shape; returns its layer, or null to discard it. */
  onCreate: (input: { id: string; geometry: FeatureGeometry; mode: string }) => { layerId: string; color: string } | null;
  onGeometryChange: (id: string, geometry: FeatureGeometry) => void;
  onSelect: (id: string | null) => void;
  onMapClick: (lngLat: { lng: number; lat: number }, point: { x: number; y: number }) => void;
  onOpenComment: (id: string) => void;
  onOpenPanorama: (id: string) => void;
  onReady?: (map: maplibregl.Map) => void;
};

const DEFAULT_COLOR = "#3b82f6" as HexColor;
/** Colour of the active layer, used for shapes that are still being drawn. */
let drawingColor: HexColor = DEFAULT_COLOR;

function colorOf(feature: GeoJSONStoreFeatures): HexColor {
  return ((feature.properties?.color as string) || drawingColor) as HexColor;
}

function toStoreFeature(f: FeatureRow & { color: string }): GeoJSONStoreFeatures {
  return {
    id: f.id,
    type: "Feature",
    geometry: f.geometry,
    properties: {
      mode: f.properties?.mode ?? defaultMode(f.geometry),
      color: f.color,
      layerId: f.layer_id,
    },
  } as GeoJSONStoreFeatures;
}

function defaultMode(geometry: FeatureGeometry) {
  return geometry.type === "Polygon" ? "polygon" : geometry.type === "LineString" ? "linestring" : "point";
}

function makeDraw(map: maplibregl.Map, canEdit: boolean) {
  const editable = {
    feature: {
      draggable: canEdit,
      coordinates: canEdit ? { midpoints: true, draggable: true, deletable: true } : undefined,
    },
  };
  const moveOnly = { feature: { draggable: canEdit } };

  return new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map }),
    modes: [
      new TerraDrawSelectMode({
        keyEvents: null,
        flags: {
          polygon: editable,
          linestring: editable,
          point: { feature: { draggable: canEdit } },
          rectangle: moveOnly,
          circle: moveOnly,
        },
        styles: {
          selectedPolygonColor: colorOf,
          selectedPolygonFillOpacity: 0.45,
          selectedPolygonOutlineColor: "#ffffff",
          selectedPolygonOutlineWidth: 3,
          selectedLineStringColor: "#ffffff",
          selectedLineStringWidth: 5,
          selectedPointColor: colorOf,
          selectedPointOutlineColor: "#ffffff",
          selectedPointOutlineWidth: 3,
          selectedPointWidth: 9,
          selectionPointColor: "#ffffff",
          selectionPointOutlineColor: "#0f172a",
          selectionPointWidth: 5,
          midPointColor: "#10b981",
          midPointOutlineColor: "#ffffff",
          midPointWidth: 4,
        },
      }),
      new TerraDrawPolygonMode({
        styles: {
          fillColor: colorOf,
          fillOpacity: 0.3,
          outlineColor: colorOf,
          outlineWidth: 2,
          closingPointColor: "#ffffff",
          closingPointOutlineColor: "#0f172a",
        },
      }),
      new TerraDrawRectangleMode({
        styles: { fillColor: colorOf, fillOpacity: 0.3, outlineColor: colorOf, outlineWidth: 2 },
      }),
      new TerraDrawCircleMode({
        styles: { fillColor: colorOf, fillOpacity: 0.3, outlineColor: colorOf, outlineWidth: 2 },
      }),
      new TerraDrawLineStringMode({
        styles: { lineStringColor: colorOf, lineStringWidth: 4 },
      }),
      new TerraDrawPointMode({
        styles: {
          pointColor: colorOf,
          pointWidth: 7,
          pointOutlineColor: "#ffffff",
          pointOutlineWidth: 2,
        },
      }),
    ],
  });
}

export function MapCanvas(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const readyRef = useRef(false);
  /** JSON of what is currently in the Terra Draw store, keyed by id. */
  const syncedRef = useRef(new Map<string, { geometry: string; color: string; layerId: string }>());
  const commentMarkers = useRef(new Map<string, maplibregl.Marker>());
  const panoMarkers = useRef(new Map<string, maplibregl.Marker>());
  const propsRef = useRef(props);
  propsRef.current = props;

  // ---------- Create the map and Terra Draw once ----------
  useEffect(() => {
    if (!containerRef.current) return;
    const { venue, basemap, canEdit } = propsRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(basemap),
      center: [venue.center_lng, venue.center_lat],
      zoom: venue.zoom,
      maxZoom: 21,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    mapRef.current = map;

    map.on("load", () => {
      const draw = makeDraw(map, canEdit);
      draw.start();
      draw.setMode("select");
      drawRef.current = draw;

      draw.on("finish", (id, context) => {
        const feature = draw.getSnapshotFeature(id);
        if (!feature) return;
        const geometry = feature.geometry as FeatureGeometry;
        if (context.action === "draw") {
          const saved = propsRef.current.onCreate({
            id: String(id),
            geometry,
            mode: context.mode,
          });
          if (!saved) {
            draw.removeFeatures([id]);
            return;
          }
          draw.updateFeatureProperties(id, { color: saved.color, layerId: saved.layerId });
          syncedRef.current.set(String(id), {
            geometry: JSON.stringify(geometry),
            color: saved.color,
            layerId: saved.layerId,
          });
        } else {
          const prev = syncedRef.current.get(String(id));
          if (prev) prev.geometry = JSON.stringify(geometry);
          propsRef.current.onGeometryChange(String(id), geometry);
        }
      });
      draw.on("select", (id) => propsRef.current.onSelect(String(id)));
      draw.on("deselect", () => propsRef.current.onSelect(null));

      // Feature name labels, drawn above Terra Draw's layers.
      map.addSource("feature-labels", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "feature-labels",
        type: "symbol",
        source: "feature-labels",
        layout: {
          "text-field": ["get", "name"],
          "text-font": LABEL_FONT,
          "text-size": 12,
          "text-offset": [0, 1.2],
          "text-allow-overlap": false,
        },
        paint: { "text-color": "#ffffff", "text-halo-color": "#0f172a", "text-halo-width": 1.5 },
      });

      readyRef.current = true;
      propsRef.current.onReady?.(map);
      syncFeatures();
      syncTool();
    });

    map.on("click", (e) => {
      const tool = propsRef.current.tool;
      if (tool === "comment" || tool === "panorama") {
        propsRef.current.onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat }, { x: e.point.x, y: e.point.y });
      }
    });

    const markers = [commentMarkers.current, panoMarkers.current];
    const synced = syncedRef.current;
    return () => {
      readyRef.current = false;
      try {
        drawRef.current?.stop();
      } catch {
        // map already torn down
      }
      drawRef.current = null;
      markers.forEach((m) => {
        m.forEach((marker) => marker.remove());
        m.clear();
      });
      synced.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---------- Keep Terra Draw's store in step with the features prop ----------
  function syncFeatures() {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map || !readyRef.current) return;
    const { features, selectedId } = propsRef.current;
    const synced = syncedRef.current;
    const wanted = new Map(features.map((f) => [f.id, f]));

    // Remove features that were deleted or hidden.
    const toRemove = [...synced.keys()].filter((id) => !wanted.has(id) && draw.hasFeature(id));
    for (const id of toRemove) {
      if (id === selectedId) {
        try {
          draw.deselectFeature(id);
        } catch {
          /* not selected in draw */
        }
      }
    }
    if (toRemove.length) draw.removeFeatures(toRemove);
    toRemove.forEach((id) => synced.delete(id));
    [...synced.keys()].forEach((id) => {
      if (!wanted.has(id)) synced.delete(id);
    });

    // Add new features and apply remote edits.
    const toAdd: GeoJSONStoreFeatures[] = [];
    for (const f of features) {
      const geometry = JSON.stringify(f.geometry);
      const current = synced.get(f.id);
      if (!current || !draw.hasFeature(f.id)) {
        toAdd.push(toStoreFeature(f));
        synced.set(f.id, { geometry, color: f.color, layerId: f.layer_id });
        continue;
      }
      if (current.geometry !== geometry && f.id !== selectedId) {
        draw.updateFeatureGeometry(f.id, f.geometry);
        current.geometry = geometry;
      }
      if (current.color !== f.color || current.layerId !== f.layer_id) {
        draw.updateFeatureProperties(f.id, { color: f.color, layerId: f.layer_id });
        current.color = f.color;
        current.layerId = f.layer_id;
      }
    }
    if (toAdd.length) {
      const results = draw.addFeatures(toAdd);
      results.forEach((r) => {
        if (!r.valid) syncedRef.current.delete(String(r.id));
      });
    }

    // Labels
    const labelSource = map.getSource("feature-labels") as maplibregl.GeoJSONSource | undefined;
    labelSource?.setData({
      type: "FeatureCollection",
      features: features
        .filter((f) => f.name)
        .map((f) => {
          const c = centroid({ type: "Feature", geometry: f.geometry, properties: {} });
          return { ...c, properties: { name: f.name } };
        }),
    });
    if (map.getLayer("feature-labels")) map.moveLayer("feature-labels");
  }

  function syncTool() {
    const draw = drawRef.current;
    if (!draw || !readyRef.current) return;
    const { tool, canEdit, selectedId } = propsRef.current;
    const drawing = DRAW_TOOLS.includes(tool) && canEdit;
    const target = drawing ? tool : tool === "select" ? "select" : "static";
    if (target !== "select" && selectedId) {
      try {
        draw.deselectFeature(selectedId);
      } catch {
        /* ignore */
      }
    }
    if (draw.getMode() !== target) draw.setMode(target);
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = tool === "comment" || tool === "panorama" ? "crosshair" : "";
  }

  useEffect(() => {
    drawingColor = (props.activeColor || DEFAULT_COLOR) as HexColor;
  }, [props.activeColor]);

  useEffect(syncFeatures, [props.features, props.selectedId]);
  useEffect(syncTool, [props.tool, props.canEdit, props.selectedId]);

  // Programmatic selection (from the sidebar)
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || !readyRef.current || props.tool !== "select") return;
    const id = props.selectedId;
    const current = draw.getSnapshot().find((f) => f.properties?.selected)?.id;
    if (id && current !== id && draw.hasFeature(id)) {
      try {
        draw.selectFeature(id);
      } catch {
        /* ignore */
      }
    }
  }, [props.selectedId, props.tool]);

  // Basemap toggle
  useEffect(() => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) setBasemap(map, props.basemap);
  }, [props.basemap]);

  // Fly to a location requested by the sidebar
  useEffect(() => {
    if (props.flyTo && mapRef.current) {
      mapRef.current.flyTo({
        center: [props.flyTo.lng, props.flyTo.lat],
        zoom: Math.max(mapRef.current.getZoom(), 18),
      });
    }
  }, [props.flyTo]);

  // ---------- Comment pins ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = commentMarkers.current;
    const pins = props.comments.filter((c) => !c.parent_id && c.lng != null && c.lat != null);
    const replies = new Map<string, number>();
    props.comments.forEach((c) => {
      if (c.parent_id) replies.set(c.parent_id, (replies.get(c.parent_id) ?? 0) + 1);
    });
    const keep = new Set(pins.map((c) => c.id));
    markers.forEach((m, id) => {
      if (!keep.has(id)) {
        m.remove();
        markers.delete(id);
      }
    });
    pins.forEach((c) => {
      const count = 1 + (replies.get(c.id) ?? 0);
      const active = c.id === props.activeCommentId;
      const html = `<span>${count}</span>`;
      const cls = `comment-pin${c.resolved ? " resolved" : ""}${active ? " active" : ""}`;
      let marker = markers.get(c.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", "Open comment");
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          propsRef.current.onOpenComment(c.id);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([c.lng!, c.lat!]).addTo(map);
        markers.set(c.id, marker);
      }
      const el = marker.getElement();
      el.className = cls;
      el.innerHTML = html;
    });
  }, [props.comments, props.activeCommentId]);

  // ---------- 360° photo pins ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = panoMarkers.current;
    const keep = new Set(props.panoramas.map((p) => p.id));
    markers.forEach((m, id) => {
      if (!keep.has(id)) {
        m.remove();
        markers.delete(id);
      }
    });
    props.panoramas.forEach((p) => {
      let marker = markers.get(p.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "pano-pin";
        el.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          propsRef.current.onOpenPanorama(p.id);
        });
        marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        markers.set(p.id, marker);
      } else {
        marker.setLngLat([p.lng, p.lat]);
      }
      marker.getElement().title = p.title;
    });
  }, [props.panoramas]);

  // MapLibre's stylesheet sets the map element to position: relative, so it fills a positioned wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" data-testid="map" />
    </div>
  );
}
