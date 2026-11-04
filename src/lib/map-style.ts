import type { StyleSpecification } from "maplibre-gl";

export type Basemap = "satellite" | "streets";

export const LABEL_FONT = ["Noto Sans Regular"];

/**
 * One style holding both base maps, so switching only toggles layer visibility
 * and never wipes the drawing layers that Terra Draw adds to the map.
 * Imagery: Esri World Imagery. Streets: CARTO Voyager. Check both providers'
 * terms before heavy commercial use.
 */
export function baseStyle(initial: Basemap = "satellite"): StyleSpecification {
  const sat = initial === "satellite" ? "visible" : "none";
  const streets = initial === "streets" ? "visible" : "none";
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      imagery: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
      },
      places: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
      },
      streets: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        maxzoom: 20,
        attribution: "© OpenStreetMap contributors © CARTO",
      },
    },
    layers: [
      { id: "base-imagery", type: "raster", source: "imagery", layout: { visibility: sat } },
      { id: "base-places", type: "raster", source: "places", layout: { visibility: sat } },
      { id: "base-streets", type: "raster", source: "streets", layout: { visibility: streets } },
    ],
  };
}

export function setBasemap(map: import("maplibre-gl").Map, basemap: Basemap) {
  const sat = basemap === "satellite" ? "visible" : "none";
  map.setLayoutProperty("base-imagery", "visibility", sat);
  map.setLayoutProperty("base-places", "visibility", sat);
  map.setLayoutProperty("base-streets", "visibility", basemap === "streets" ? "visible" : "none");
}
