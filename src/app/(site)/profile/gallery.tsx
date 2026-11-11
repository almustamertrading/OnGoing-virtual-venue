"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import type { GalleryItem } from "@/lib/site-content";

export function PhotoLibrary({ items, categories }: { items: GalleryItem[]; categories: string[] }) {
  const [cat, setCat] = useState<string>("all");
  const [open, setOpen] = useState<number | null>(null);
  const list = useMemo(() => (cat === "all" ? items : items.filter((i) => i.category === cat)), [cat, items]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : (o + 1) % list.length));
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : (o - 1 + list.length) % list.length));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, list.length]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {["all", ...categories].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { setCat(c); setOpen(null); }}
            aria-pressed={cat === c}
            className={`border px-3 py-1.5 text-xs transition ${cat === c ? "border-gold bg-gold text-ink font-extrabold" : "border-line text-sand/80 hover:border-gold"}`}
          >
            {c === "all" ? `الكل (${items.length})` : c}
          </button>
        ))}
      </div>

      <div className="mt-6 columns-1 gap-3 sm:columns-2 lg:columns-3 [&>*]:mb-3">
        {list.map((it, idx) => (
          <button
            key={it.src}
            type="button"
            onClick={() => setOpen(idx)}
            className="photo-bw grain relative block w-full overflow-hidden border border-line bg-ink2 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            style={{ aspectRatio: `${it.w} / ${it.h}` }}
            aria-label={`${it.category} — تكبير`}
          >
            <Image src={it.src} alt={it.category} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
            <span className="eyebrow absolute bottom-2 left-2 bg-ink/80 px-2 py-1 text-[10px] text-left">{it.category}</span>
          </button>
        ))}
      </div>

      {open !== null && list[open] && (
        <div role="dialog" aria-modal="true" aria-label="عرض الصورة" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4" onClick={() => setOpen(null)}>
          <button type="button" aria-label="إغلاق" onClick={() => setOpen(null)} className="absolute top-4 left-4 text-sand hover:text-gold"><X size={26} /></button>
          <button type="button" aria-label="السابق" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + list.length) % list.length); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-sand hover:text-gold"><ChevronRight size={34} /></button>
          <button type="button" aria-label="التالي" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % list.length); }} className="absolute left-3 top-1/2 -translate-y-1/2 text-sand hover:text-gold"><ChevronLeft size={34} /></button>
          <figure className="relative max-h-[88vh] w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative mx-auto" style={{ aspectRatio: `${list[open].w} / ${list[open].h}`, maxHeight: "80vh", maxWidth: "100%", width: `min(100%, calc(80vh * ${list[open].w} / ${list[open].h}))` }}>
              <Image src={list[open].src} alt={list[open].category} fill sizes="100vw" className="object-contain" priority />
            </div>
            <figcaption className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>{list[open].category}</span>
              <span className="num" dir="ltr">{open + 1} / {list.length}</span>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
