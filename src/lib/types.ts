import type { Geometry, LineString, Point, Polygon } from "geojson";

export type MemberRole = "owner" | "editor" | "viewer";

export type EventRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
};

export type VenueRow = {
  id: string;
  event_id: string;
  name: string;
  address: string | null;
  center_lng: number;
  center_lat: number;
  zoom: number;
  created_at: string;
};

export type LayerRow = {
  id: string;
  event_id: string;
  venue_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
};

export type FeatureGeometry = Point | LineString | Polygon;

export type FeatureRow = {
  id: string;
  event_id: string;
  venue_id: string;
  layer_id: string;
  name: string;
  notes: string;
  geometry: FeatureGeometry;
  properties: { mode?: string } & Record<string, unknown>;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CommentRow = {
  id: string;
  event_id: string;
  venue_id: string;
  parent_id: string | null;
  body: string;
  lng: number | null;
  lat: number | null;
  resolved: boolean;
  created_by: string;
  created_at: string;
};

export type PanoramaRow = {
  id: string;
  event_id: string;
  venue_id: string;
  title: string;
  lng: number;
  lat: number;
  storage_path: string;
  created_by: string;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
};

export type AnyGeometry = Geometry;
