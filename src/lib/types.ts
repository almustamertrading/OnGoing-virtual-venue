import type { Geometry, LineString, Point, Polygon } from "geojson";

export type MemberRole = "owner" | "editor" | "viewer";
export type OrgRole = "admin" | "manager" | "staff";

export type ProjectStatus =
  | "lead"
  | "proposal"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "cancelled";

export type ProjectType =
  | "sports_event"
  | "conference"
  | "exhibition"
  | "festival"
  | "corporate_event"
  | "production"
  | "other";

export type ProjectRow = {
  id: string;
  organization_id: string;
  client_id: string | null;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  project_type: ProjectType;
  location: string | null;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  rfp_reference: string | null;
  submission_method: string | null;
  submission_location: string | null;
  submission_deadline: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ClientRow = {
  id: string;
  organization_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type BoqItemRow = {
  id: string;
  project_id: string;
  description: string;
  unit: string;
  quantity: number | null;
  unit_price: number | null;
  notes: string;
  sort_order: number;
};

export type EvaluationCriterionRow = {
  id: string;
  project_id: string;
  criterion: string;
  weight: number | null;
  met: boolean;
  evidence: string;
  sort_order: number;
};

export type PlanPhaseRow = {
  id: string;
  project_id: string;
  title: string;
  objective: string;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
};

export type TeamRoleRow = {
  id: string;
  project_id: string;
  title: string;
  responsibility: string;
  headcount: number;
  reports_to: string;
  assignee_id: string | null;
  sort_order: number;
};

export type ScopeItemRow = {
  id: string;
  project_id: string;
  kind: "scope" | "deliverable";
  title: string;
  description: string;
  status: "planned" | "in_progress" | "done";
  due_date: string | null;
  sort_order: number;
  created_at: string;
};

export type MilestoneRow = {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  sort_order: number;
};

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  milestone_id: string | null;
  scope_item_id: string | null;
  completed_at: string | null;
  created_at: string;
};

export type ActivityRow = {
  id: number;
  project_id: string;
  actor_id: string | null;
  action: "created" | "updated" | "deleted";
  entity_type: string;
  entity_id: string | null;
  details: { label?: string; changed?: string[]; from?: string; to?: string; member?: string; role?: string };
  created_at: string;
};

export type MemberRow = {
  user_id: string;
  role: MemberRole;
  responsibility: string;
  email: string;
};

export type VenueRow = {
  id: string;
  project_id: string;
  name: string;
  address: string | null;
  center_lng: number;
  center_lat: number;
  zoom: number;
  created_at: string;
};

export type LayerRow = {
  id: string;
  project_id: string;
  venue_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
};

export type FeatureGeometry = Point | LineString | Polygon;

export type FeatureRow = {
  id: string;
  project_id: string;
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
  project_id: string;
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
  project_id: string;
  venue_id: string;
  title: string;
  lng: number;
  lat: number;
  storage_path: string;
  created_by: string;
  created_at: string;
};

export type LayoutRow = {
  id: string;
  project_id: string;
  venue_id: string | null;
  name: string;
  background_path: string | null;
  bg_width: number | null;
  bg_height: number | null;
  scale_m_per_px: number | null;
  is_template: boolean;
  created_at: string;
};

export type LayoutItemKind =
  | "table_round"
  | "table_rect"
  | "chair"
  | "stage"
  | "bar"
  | "av"
  | "entrance"
  | "exit"
  | "vip"
  | "booth"
  | "text";

export type LayoutItemRow = {
  id: string;
  layout_id: string;
  project_id: string;
  kind: LayoutItemKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
  props: Record<string, unknown>;
  sort_order: number;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
};

export type AnyGeometry = Geometry;
