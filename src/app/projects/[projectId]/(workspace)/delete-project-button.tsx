"use client";

import { useTransition } from "react";
import { deleteProject } from "../../actions";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-danger w-full text-xs"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this project with all its tasks, venues, comments and photos? This cannot be undone.")) {
          start(() => deleteProject(projectId));
        }
      }}
    >
      {pending ? "Deleting…" : "Delete project"}
    </button>
  );
}
