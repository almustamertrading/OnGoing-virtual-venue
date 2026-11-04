import * as maplibregl from "maplibre-gl";

// Served from public/vendor, copied there by scripts/copy-maplibre-worker.mjs.
maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

export { maplibregl };
