"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceTabs({
  projectId,
  counts,
  hidden = [],
}: {
  projectId: string;
  counts: Record<string, number>;
  /** Tabs the viewer has no permission for (the pages also refuse them). */
  hidden?: string[];
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Overview", key: "overview" },
    { href: `${base}/scope`, label: "Scope", key: "scope" },
    { href: `${base}/plan`, label: "Plan", key: "plan" },
    { href: `${base}/pricing`, label: "Pricing", key: "pricing" },
    { href: `${base}/procurement`, label: "Procurement", key: "procurement" },
    { href: `${base}/finance`, label: "Finance", key: "finance" },
    { href: `${base}/structure`, label: "Structure", key: "structure" },
    { href: `${base}/evaluation`, label: "Evaluation", key: "evaluation" },
    { href: `${base}/tasks`, label: "Tasks", key: "tasks" },
    { href: `${base}/team`, label: "Team", key: "team" },
    { href: `${base}/venues`, label: "Venues", key: "venues" },
    { href: `${base}/layouts`, label: "Layouts", key: "layouts" },
    { href: `${base}/documents`, label: "Documents", key: "documents" },
    { href: `${base}/inventory`, label: "Inventory", key: "inventory" },
    { href: `${base}/activity`, label: "Activity", key: "activity" },
  ].filter((t) => !hidden.includes(t.key));
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Project sections">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${active ? "border-emerald-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            {t.label}
            {counts[t.key] ? <span className="ml-1.5 text-xs text-slate-500">{counts[t.key]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
