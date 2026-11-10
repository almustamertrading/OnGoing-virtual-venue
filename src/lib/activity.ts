import { PROJECT_STATUS, TASK_STATUS } from "./format";
import type { ActivityRow, ProjectStatus, TaskStatus } from "./types";

const NOUN: Record<string, string> = {
  projects: "the project",
  tasks: "task",
  milestones: "milestone",
  scope_items: "scope item",
  project_members: "team member",
  venues: "venue",
  layers: "map layer",
  features: "map shape",
  comments: "a map comment",
  panoramas: "360° photo",
  project_requirements: "tender requirement",
};

const FIELD: Record<string, string> = {
  title: "title",
  name: "name",
  description: "description",
  due_date: "due date",
  assignee_id: "assignee",
  priority: "priority",
  milestone_id: "milestone",
  scope_item_id: "scope link",
  client_id: "client",
  start_date: "start date",
  end_date: "end date",
  budget: "budget",
  location: "location",
  project_type: "type",
  notes: "notes",
  done: "completion",
  role: "role",
  responsibility: "responsibility",
  layer_id: "layer",
};

function statusLabel(entity: string, value?: string) {
  if (!value) return "";
  if (entity === "projects") return PROJECT_STATUS[value as ProjectStatus]?.label ?? value;
  if (entity === "tasks") return TASK_STATUS[value as TaskStatus] ?? value;
  return value.replace("_", " ");
}

/** A plain-English line for one activity entry, without the actor. */
export function describeActivity(a: ActivityRow): string {
  const d = a.details ?? {};
  const noun = NOUN[a.entity_type] ?? a.entity_type.replace("_", " ");
  const label = d.label ? ` “${d.label}”` : "";

  if (a.entity_type === "project_members") {
    const who = d.member ?? "someone";
    if (a.action === "created") return `added ${who} to the team as ${d.role}`;
    if (a.action === "deleted") return `removed ${who} from the team`;
    return `changed ${who}'s ${(d.changed ?? []).map((f) => FIELD[f] ?? f).join(" and ")}`;
  }
  if (a.entity_type === "comments") return `commented on the map:${label}`;
  if (a.entity_type === "projects" && a.action === "created") return `created the project`;

  if (a.action === "created") return `added ${noun}${label}`;
  if (a.action === "deleted") return `deleted ${noun}${label}`;

  if (d.from && d.to) {
    return `moved ${noun}${label} from ${statusLabel(a.entity_type, d.from)} to ${statusLabel(a.entity_type, d.to)}`;
  }
  if (a.entity_type === "milestones" && d.changed?.includes("done")) return `updated milestone${label}`;
  const fields = (d.changed ?? []).map((f) => FIELD[f] ?? f.replace("_", " "));
  return `changed the ${fields.join(", ")} of ${noun}${label}`;
}
