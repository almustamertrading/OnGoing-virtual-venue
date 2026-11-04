"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ProjectForm } from "@/components/project-form";
import type { ClientRow } from "@/lib/types";
import { createProject } from "./actions";

export function CreateProject({ organizationId, clients }: { organizationId: string; clients: ClientRow[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} /> New project
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
      <div className="card w-full max-w-lg bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">New project</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <ProjectForm organizationId={organizationId} clients={clients} action={createProject} submitLabel="Create project" />
      </div>
    </div>
  );
}
