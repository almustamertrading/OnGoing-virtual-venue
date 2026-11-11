"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/profile", label: "الملف التعريفي" },
  { href: "/#services", label: "خدماتنا" },
  { href: "/work", label: "أعمالنا" },
  { href: "/contact", label: "تواصل" },
];

export function Wordmark({ className = "h-7", light = false }: { className?: string; light?: boolean }) {
  return (
    <Image
      src={light ? "/brand/wordmark-light.svg" : "/brand/wordmark-dark.svg"}
      alt="Ongoing Events"
      width={515}
      height={96}
      priority
      className={`${className} w-auto`}
    />
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Ongoing Events — الرئيسية" onClick={() => setOpen(false)}>
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-sand/80 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-gold">{l.label}</Link>
          ))}
          <Link href="/login" className="eyebrow border border-line px-3 py-2 transition hover:border-gold">
            Team login
          </Link>
        </nav>

        <button type="button" className="text-sand md:hidden" aria-label={open ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-line bg-ink px-4 py-3 md:hidden">
          <ul className="space-y-1 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block px-2 py-2 text-sand hover:text-gold">{l.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/login" onClick={() => setOpen(false)} className="mt-1 block px-2 py-2 text-gold">دخول الفريق</Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
