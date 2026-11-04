"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { maplibregl } from "@/lib/maplibre";
import { Search } from "lucide-react";
import { baseStyle } from "@/lib/map-style";
import { createVenue, type ActionState } from "../../../actions";

type Place = { name: string; lng: number; lat: number };

async function geocode(q: string): Promise<Place[]> {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.features ?? []).map((f: GeoJSON.Feature<GeoJSON.Point>) => {
    const p = f.properties as Record<string, string>;
    const label = [p.name, p.city, p.country].filter(Boolean).join(", ");
    return { name: label, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
  });
}

export function VenueCreator({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createVenue.bind(null, projectId),
    {},
  );
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [point, setPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [zoom, setZoom] = useState(2);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [address, setAddress] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!mapEl.current) return;
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: baseStyle("satellite"),
      center: [10, 30],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("click", (e: maplibregl.MapMouseEvent) => setPoint({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    map.on("zoomend", () => setZoom(map.getZoom()));
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return;
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: "#10b981", draggable: true })
        .setLngLat(point)
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const ll = markerRef.current!.getLngLat();
        setPoint({ lng: ll.lng, lat: ll.lat });
      });
    } else {
      markerRef.current.setLngLat(point);
    }
  }, [point]);

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await geocode(query));
    } finally {
      setSearching(false);
    }
  }

  function choose(place: Place) {
    setPoint({ lng: place.lng, lat: place.lat });
    setAddress(place.name);
    setResults([]);
    mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: 16 });
  }

  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-semibold text-white">Add a venue</h2>
      <div>
        <label className="label" htmlFor="venue-name">Venue name</label>
        <input id="venue-name" name="name" required placeholder="e.g. National Stadium" className="field" />
      </div>
      <div className="relative">
        <label className="label" htmlFor="venue-search">Find the location</label>
        <div className="flex gap-2">
          <input
            id="venue-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
            placeholder="Search a stadium, address or city"
            className="field"
          />
          <button type="button" onClick={runSearch} className="btn-ghost" disabled={searching}>
            <Search size={16} />
          </button>
        </div>
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900 text-sm shadow-xl">
            {results.map((r) => (
              <li key={`${r.lng},${r.lat}`}>
                <button
                  type="button"
                  onClick={() => choose(r)}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-800"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div ref={mapEl} className="h-56 overflow-hidden rounded-lg border border-slate-800" />
      <p className="text-xs text-slate-500">
        {point
          ? `Pinned at ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}. Drag the pin to adjust.`
          : "Search above or click the map to pin the venue."}
      </p>
      <input type="hidden" name="lng" value={point?.lng ?? ""} />
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="zoom" value={Math.max(zoom, 15)} />
      <input type="hidden" name="address" value={address} />
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending || !point}>
        {pending ? "Creating…" : "Create venue"}
      </button>
    </form>
  );
}
