"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, FileText, FolderKanban, Files, LayoutDashboard, Settings } from "lucide-react";

const LINKS = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/summary", label: "Summary", icon: LayoutDashboard },
  { href: "/proposals", label: "Proposals", icon: FileText },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/documents", label: "Documents", icon: Files },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings/account", match: "/settings", label: "Settings", icon: Settings },
];

/** Main navigation between platform modules. Labels collapse to icons on narrow screens. */
export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-0.5 overflow-x-auto">
      {LINKS.map(({ href, match, label, icon: Icon }) => {
        const base = match ?? href;
        const active = pathname === base || pathname.startsWith(`${base}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs whitespace-nowrap ${
              active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <Icon size={15} aria-hidden />
            <span className="hidden md:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
