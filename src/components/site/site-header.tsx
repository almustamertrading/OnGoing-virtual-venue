"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { company } from "@/lib/site-content";

const LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/#services", label: "خدماتنا" },
  { href: "/work", label: "أعمالنا" },
  { href: "/contact", label: "تواصل" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0b]/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-extrabold text-black">FS</span>
          <span className="text-base font-extrabold tracking-tight text-white">{company.nameAr}</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-stone-300 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-amber-300">{l.label}</Link>
          ))}
          <Link href="/login" className="rounded-lg border border-white/15 px-3 py-1.5 text-stone-200 transition hover:border-amber-400/60 hover:text-amber-300">
            دخول الفريق
          </Link>
        </nav>

        <button type="button" className="text-stone-200 md:hidden" aria-label={open ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/10 bg-[#0a0a0b] px-4 py-3 md:hidden">
          <ul className="space-y-1 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2 text-stone-200 hover:bg-white/5">{l.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/login" onClick={() => setOpen(false)} className="mt-1 block rounded-md bg-amber-500/15 px-2 py-2 text-amber-300">دخول الفريق</Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
