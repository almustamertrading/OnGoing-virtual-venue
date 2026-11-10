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
  kind: string;
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

export type SupplierRow = {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  rating: number;
  notes: string;
};

export type RfqStatus = "draft" | "sent" | "awarded" | "closed";
export type QuoteStatus = "pending" | "received" | "accepted" | "rejected";

export type RfqRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  category: string;
  status: RfqStatus;
  due_date: string | null;
  sort_order: number;
};

export type QuoteRow = {
  id: string;
  rfq_id: string;
  project_id: string;
  supplier_id: string | null;
  supplier_name: string;
  amount: number | null;
  notes: string;
  status: QuoteStatus;
  sort_order: number;
  scope_basis: "unspecified" | "supply_only" | "supply_install" | "service" | "rental";
  exclusions: string;
  valid_until: string | null;
  lead_time_days: number | null;
  payment_terms: string;
  award_reason: string;
  awarded_by: string | null;
  awarded_at: string | null;
};

export type InventoryItemRow = {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unit_rate: number | null;
  notes: string;
};

export type InvoiceStatus = "draft" | "sent" | "paid";

export type InvoiceRow = {
  id: string;
  project_id: string;
  number: string;
  title: string;
  amount: number;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  sort_order: number;
};

export type ExpenseRow = {
  id: string;
  project_id: string;
  label: string;
  category: string;
  vendor: string;
  amount: number;
  incurred_on: string | null;
  sort_order: number;
};

export type ProposalType =
  | "technical_financial" | "creative_concept" | "boq_quotation"
  | "rfp_response" | "sponsorship" | "venue_operations";

export type ProposalStatus =
  | "draft" | "ai_generated" | "under_review" | "changes_requested"
  | "approved_internally" | "sent_to_client" | "awaiting_response"
  | "accepted" | "rejected" | "expired" | "converted";

export type ProposalRow = {
  id: string;
  organization_id: string;
  client_id: string | null;
  project_id: string | null;
  reference: string;
  title: string;
  proposal_type: ProposalType;
  status: ProposalStatus;
  summary: string;
  brief: string;
  vat_rate: number;
  owner_id: string | null;
  issue_date: string | null;
  due_date: string | null;
  valid_until: string | null;
  version: number;
  created_at: string;
  template_id: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
};

export type ProposalTemplateSection = { heading: string; guidance: string };

export type ProposalTemplateRow = {
  id: string;
  organization_id: string;
  name: string;
  proposal_type: ProposalType;
  description: string;
  sections: ProposalTemplateSection[];
  created_by: string;
  created_at: string;
  updated_at: string;
};

/** A frozen copy of a proposal's client-facing content (never internal costs). */
export type ProposalSnapshot = {
  proposal: {
    title: string;
    reference: string;
    proposal_type: ProposalType;
    summary: string;
    client_id: string | null;
    vat_rate: number;
    issue_date: string | null;
    due_date: string | null;
    valid_until: string | null;
  } | null;
  sections: { heading: string; body: string; ai_generated: boolean }[];
  items: {
    category: string | null;
    description: string;
    specification: string | null;
    quantity: number;
    unit: string;
    unit_price: number;
    is_optional: boolean;
  }[];
};

export type ProposalVersionRow = {
  id: string;
  proposal_id: string;
  organization_id: string;
  version: number;
  status: ProposalStatus;
  note: string;
  created_by: string | null;
  created_at: string;
};

export type ProposalReviewDecision = "comment" | "changes_requested" | "approved";

export type ProposalReviewRow = {
  id: string;
  proposal_id: string;
  organization_id: string;
  version: number;
  reviewer_id: string;
  decision: ProposalReviewDecision;
  comment: string;
  created_at: string;
};

export type ProposalSectionRow = {
  id: string;
  proposal_id: string;
  organization_id: string;
  heading: string;
  body: string;
  ai_generated: boolean;
  sort_order: number;
};

export type ProposalItemRow = {
  id: string;
  proposal_id: string;
  organization_id: string;
  category: string;
  description: string;
  specification: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  unit_price: number;
  supplier_id: string | null;
  is_optional: boolean;
  sort_order: number;
};

// ---------------- Stage 3 (migration 20261109180000) ----------------

export type OrganizationRow = {
  id: string;
  name: string;
  email_domain: string | null;
  currency: string;
  timezone: string;
  default_vat_rate: number;
  tax_number: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationAuditAction =
  | "member_added" | "member_removed" | "role_changed" | "capabilities_changed"
  | "domain_added" | "domain_removed" | "settings_changed";

export type OrganizationAuditRow = {
  id: number;
  organization_id: string;
  actor_id: string | null;
  action: OrganizationAuditAction;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type CalendarEventKind = "meeting" | "site_visit" | "rehearsal" | "load_in" | "event_day" | "deadline" | "other";

export type CalendarEventRow = {
  id: string;
  organization_id: string;
  project_id: string | null;
  title: string;
  description: string;
  location: string;
  kind: CalendarEventKind;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/** One row of public.calendar_feed(org, range_start, range_end). */
export type CalendarFeedItem = {
  source: "event" | "project" | "submission" | "milestone" | "task" | "phase" | "proposal" | "rfq" | "invoice" | "requirement";
  source_id: string;
  project_id: string | null;
  /** Project code (or proposal reference) for display. */
  label: string | null;
  title: string;
  all_day: boolean;
  start_date: string;
  end_date: string;
  starts_at: string | null;
  ends_at: string | null;
  kind: string;
  status: string | null;
};

export type DocumentCategory = "contract" | "rfp" | "proposal" | "drawing" | "permit" | "invoice" | "photo" | "report" | "other";

export type DocumentRow = {
  id: string;
  organization_id: string;
  project_id: string | null;
  title: string;
  description: string;
  category: DocumentCategory;
  /** <organization_id>/<project_id | 'org'>/<document_id>/<file name> in the private `documents` bucket. */
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  version: number;
  supersedes_id: string | null;
  is_confidential: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ReportPipelineRow = { status: ProjectStatus; projects: number; budget_total: number };
export type ReportProposalsRow = { status: ProposalStatus; proposals: number; value_total: number };
export type ReportProjectFinanceRow = {
  project_id: string; code: string; name: string; status: ProjectStatus; budget: number | null;
  invoiced: number; paid: number; outstanding: number; expenses: number; margin: number;
};
export type ReportDeliveryRow = {
  project_id: string; code: string; name: string; status: ProjectStatus;
  tasks_total: number; tasks_done: number; tasks_overdue: number; tasks_blocked: number;
  milestones_total: number; milestones_done: number; next_milestone: string | null;
};
export type ReportProcurementRow = {
  project_id: string; code: string; name: string; rfqs: number; rfqs_awarded: number;
  /** null when the caller has no finance access to the project. */
  quotes: number | null; awarded_value: number | null;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
};

export type AnyGeometry = Geometry;

// ---------------- Shared AI findings + tender register (migration 20261110100000) ----------------

export type AiFindingWorkflow = "tender" | "boq" | "pricing" | "procurement" | "operations" | "management";
export type AiFindingStatus = "proposed" | "accepted" | "rejected";

/** An AI result awaiting or after human review, with its source in a document. */
export type AiFindingRow = {
  id: string;
  organization_id: string;
  project_id: string | null;
  document_id: string | null;
  workflow: AiFindingWorkflow;
  kind: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  finance_only: boolean;
  status: AiFindingStatus;
  source_page: number | null;
  source_excerpt: string;
  source_verified: boolean;
  data: Record<string, unknown>;
  ai_usage_log_id: number | null;
  target_table: string | null;
  target_id: string | null;
  review_note: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type RequirementCategory =
  | "document" | "certificate" | "bond" | "insurance" | "form" | "site_visit" | "deadline" | "eligibility" | "technical" | "other";
export type RequirementStatus = "open" | "in_progress" | "met" | "not_applicable";

export type ProjectRequirementRow = {
  id: string;
  project_id: string;
  organization_id: string;
  title: string;
  category: RequirementCategory;
  details: string;
  mandatory: boolean;
  status: RequirementStatus;
  owner_id: string | null;
  due_date: string | null;
  document_id: string | null;
  finding_id: string | null;
  source_ref: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

