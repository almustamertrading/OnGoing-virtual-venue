import { PROJECT_STATUS } from "@/lib/format";
import type { ProjectStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = PROJECT_STATUS[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.tone}`}>{s.label}</span>;
}
