"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtSign, Building2, Eye, Lock, ScrollText, UserRound, Users } from "lucide-react";

const SECTIONS = [
  { href: "/settings/account", label: "الحساب", icon: UserRound, access: "everyone" },
  { href: "/settings/organization", label: "المنظمة", icon: Building2, access: "read" },
  { href: "/settings/members", label: "الأعضاء", icon: Users, access: "admin" },
  { href: "/settings/domains", label: "نطاقات البريد", icon: AtSign, access: "admin" },
  { href: "/settings/audit", label: "سجل التدقيق", icon: ScrollText, access: "admin" },
] as const;

/**
 * Settings sections: a sidebar on wide screens, a horizontal scroller on phones.
 * isAdmin is null while the viewer's role is loading; for non-admins, admin-only sections show a
 * lock and Organisation is marked read-only (the pages and the database enforce both).
 */
export function SettingsNav({ isAdmin }: { isAdmin: boolean | null }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // On phones the strip scrolls sideways: bring the current section into view (only the strip moves).
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const strip = nav.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.left < strip.left || item.right > strip.right) {
      nav.scrollBy({ left: item.left + item.width / 2 - (strip.left + strip.width / 2) });
    }
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="أقسام الإعدادات"
      className="-mx-4 shrink-0 overflow-x-auto px-4 md:sticky md:top-4 md:mx-0 md:w-52 md:overflow-visible md:px-0"
    >
      <p className="mb-2 hidden px-3 text-xs font-medium text-slate-500 md:block">الإعدادات</p>
      <ul className="flex gap-1 md:flex-col">
        {SECTIONS.map(({ href, label, icon: Icon, access }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const locked = isAdmin === false && access === "admin";
          const readOnly = isAdmin === false && access === "read";
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                  active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <Icon size={16} aria-hidden />
                <span>{label}</span>
                {locked && (
                  <span className="inline-flex md:ms-auto" title="لمدير المنظمة فقط">
                    <Lock size={13} className="text-amber-300" aria-hidden />
                    <span className="sr-only">(لمدير المنظمة فقط)</span>
                  </span>
                )}
                {readOnly && (
                  <span className="inline-flex md:ms-auto" title="للعرض فقط">
                    <Eye size={13} className="text-slate-500" aria-hidden />
                    <span className="sr-only">(للعرض فقط)</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
