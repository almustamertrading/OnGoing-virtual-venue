"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { ProjectForm } from "@/components/project-form";
import { PROJECT_STATUS, PROJECT_TYPE, formatMoney, formatRange } from "@/lib/format";
import type { ClientRow, ProjectRow, ProjectStatus } from "@/lib/types";
import { setProjectStatus, updateProject } from "../../actions";

export function ProjectDetails({
  project,
  client,
  clients,
  canEdit,
  isOwner,
  currency,
}: {
  project: ProjectRow;
  client: ClientRow | null;
  clients: ClientRow[];
  canEdit: boolean;
  isOwner: boolean;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <section className="card p-5">
        <h2 className="mb-4 font-semibold text-white">Edit project details</h2>
        <ProjectForm
          organizationId={project.organization_id}
          clients={clients}
          project={project}
          action={updateProject.bind(null, project.id)}
          submitLabel="Save changes"
          onDone={() => setEditing(false)}
        />
        <button type="button" className="btn-ghost mt-2 w-full" onClick={() => setEditing(false)}>Cancel</button>
      </section>
    );
  }

  const rows: [string, string][] = [
    ["Client", client ? [client.name, client.contact_name].filter(Boolean).join(" · ") : "Not set"],
    ["Type", PROJECT_TYPE[project.project_type]],
    ["Dates", formatRange(project.start_date, project.end_date) || "Not set"],
    ["Location", project.location || "Not set"],
    ["Budget", project.budget != null ? formatMoney(project.budget, currency) : "Not set"],
  ];

  return (
    <section className="card p-5" data-testid="project-details">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-white">Key information</h2>
        <div className="flex items-center gap-2">
          {isOwner && (
            <select
              aria-label="Project status"
              value={project.status}
              disabled={pending}
              onChange={(e) => start(() => setProjectStatus(project.id, e.target.value as ProjectStatus))}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            >
              {Object.entries(PROJECT_STATUS).map(([v, s]) => (
                <option key={v} value={v}>{s.label}</option>
              ))}
            </select>
          )}
          {canEdit && isOwner && (
            <button type="button" className="btn-ghost py-1 text-xs" onClick={() => setEditing(true)}>
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-0.5 text-slate-200">{v}</dd>
          </div>
        ))}
      </dl>
      {project.description && <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{project.description}</p>}
    </section>
  );
}
