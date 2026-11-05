"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Copy, Loader2, Minus, Plus, Ruler, Trash2, Upload } from "lucide-react";
import { createClient, withRealtimeAuth } from "@/lib/supabase/client";
import {
  LAYOUT_ASSETS,
  LAYOUT_TEMPLATES,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  assetOf,
  roundTableWithSeats,
  ceremonyRow,
  TABLE_KINDS,
  SEAT_KINDS,
  type DraftItem,
  type LayoutItemKind,
} from "@/lib/layout-assets";
import type { LayoutItemRow, LayoutRow } from "@/lib/types";
import { LayoutBlock } from "./layout-block";

type View = { zoom: number; tx: number; ty: number };

export function LayoutEditor({
  projectId,
  projectName,
  layout,
  canEdit,
  email,
}: {
  projectId: string;
  projectName: string;
  layout: LayoutRow;
  canEdit: boolean;
  email: string;
}) {
  const [supabase] = useState(() => createClient());
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [bg, setBg] = useState({ path: layout.background_path, w: layout.bg_width, h: layout.bg_height });
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [items, setItems] = useState<LayoutItemRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View>({ zoom: 0.5, tx: 40, ty: 40 });
  const [uploading, setUploading] = useState(false);
  const [panning, setPanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scale, setScale] = useState<number | null>(layout.scale_m_per_px);
  const [scaleMode, setScaleMode] = useState(false);
  const scalePts = useRef<{ x: number; y: number }[]>([]);
  const [seatsPerTable, setSeatsPerTable] = useState(8);
  const [rowLen, setRowLen] = useState(12);

  const draggingRef = useRef<string | null>(null);

  // Load items + subscribe to live changes (unique channel name avoids a
  // double-invoked effect adding a listener to an already-subscribed channel).
  useEffect(() => {
    let cancelled = false;
    const channel = supabase
      .channel(`layout:${layout.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "layout_items", filter: `layout_id=eq.${layout.id}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "DELETE") return prev.filter((i) => i.id !== (payload.old as LayoutItemRow).id);
            const row = payload.new as LayoutItemRow;
            if (draggingRef.current === row.id) return prev;
            const exists = prev.some((i) => i.id === row.id);
            return exists ? prev.map((i) => (i.id === row.id ? row : i)) : [...prev, row];
          });
        },
      );
    (async () => {
      const { data } = await supabase.from("layout_items").select("*").eq("layout_id", layout.id).order("sort_order");
      if (!cancelled && data) setItems(data as LayoutItemRow[]);
      await withRealtimeAuth(supabase);
      if (!cancelled) channel.subscribe();
    })();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, layout.id]);

  useEffect(() => {
    let active = true;
    if (!bg.path) return;
    supabase.storage.from("layouts").createSignedUrl(bg.path, 3600).then(({ data }) => {
      if (active && data) setBgUrl(data.signedUrl);
    });
    return () => {
      active = false;
    };
  }, [supabase, bg.path]);

  const screenToBg = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: (clientX - rect.left - view.tx) / view.zoom, y: (clientY - rect.top - view.ty) / view.zoom };
    },
    [view],
  );

  const viewCenterBg = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? screenToBg(rect.left + rect.width / 2, rect.top + rect.height / 2) : { x: 200, y: 200 };
  }, [screenToBg]);

  async function uploadBackground(file: File) {
    setError(null);
    setUploading(true);
    try {
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          resolve({ w: img.naturalWidth, h: img.naturalHeight });
          URL.revokeObjectURL(url);
        };
        img.onerror = () => reject(new Error("bad image"));
        img.src = url;
      });
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${projectId}/${layout.id}.${ext}`;
      const up = await supabase.storage.from("layouts").upload(path, file, { contentType: file.type, upsert: true });
      if (up.error) throw up.error;
      const { error: updErr } = await supabase
        .from("layouts")
        .update({ background_path: path, bg_width: dims.w, bg_height: dims.h })
        .eq("id", layout.id);
      if (updErr) throw updErr;
      setBg({ path, w: dims.w, h: dims.h });
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const zoom = Math.min(rect.width / dims.w, rect.height / dims.h) * 0.9;
        setView({ zoom, tx: (rect.width - dims.w * zoom) / 2, ty: (rect.height - dims.h * zoom) / 2 });
      }
    } catch (e) {
      setError((e as Error).message || "تعذّر رفع الصورة.");
    } finally {
      setUploading(false);
    }
  }

  const nextSort = () => items.reduce((m, i) => Math.max(m, i.sort_order), 0) + 1;

  async function insertDrafts(drafts: DraftItem[]) {
    if (!drafts.length) return;
    let so = nextSort();
    const rows = drafts.map((d) => ({ ...d, layout_id: layout.id, project_id: projectId, sort_order: so++ }));
    const { data, error: insErr } = await supabase.from("layout_items").insert(rows).select("*");
    if (insErr) return setError(insErr.message);
    if (data) setItems((prev) => [...prev, ...(data as LayoutItemRow[])]);
  }

  async function addAsset(kind: LayoutItemKind) {
    const def = assetOf(kind);
    const c = viewCenterBg();
    await insertDrafts([
      { kind, label: def.label, x: Math.round(c.x - def.w / 2), y: Math.round(c.y - def.h / 2), w: def.w, h: def.h, rotation: 0, color: def.color },
    ]);
    setSelected(null);
  }

  async function addSeatedTable() {
    const c = viewCenterBg();
    await insertDrafts(roundTableWithSeats(c.x, c.y, Math.max(1, Math.min(20, seatsPerTable)), String(tables + 1)));
  }
  async function addRow() {
    const c = viewCenterBg();
    const n = Math.max(1, Math.min(40, rowLen));
    await insertDrafts(ceremonyRow(c.x - (n * 28) / 2, c.y, n));
  }

  const patchItem = useCallback(
    async (id: string, patch: Partial<LayoutItemRow>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      await supabase.from("layout_items").update(patch).eq("id", id);
    },
    [supabase],
  );

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selected === id) setSelected(null);
    await supabase.from("layout_items").delete().eq("id", id);
  }

  async function duplicateItem(it: LayoutItemRow) {
    await insertDrafts([
      { kind: it.kind as LayoutItemKind, label: it.label, x: it.x + 24, y: it.y + 24, w: it.w, h: it.h, rotation: it.rotation, color: it.color },
    ]);
  }

  async function saveScale(mPerPx: number) {
    setScale(mPerPx);
    await supabase.from("layouts").update({ scale_m_per_px: mPerPx }).eq("id", layout.id);
  }

  // --- Pan / scale-pick ---
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  function onCanvasPointerDown(e: React.PointerEvent) {
    if (scaleMode) {
      const p = screenToBg(e.clientX, e.clientY);
      scalePts.current.push(p);
      if (scalePts.current.length === 2) {
        const [a, b] = scalePts.current;
        const px = Math.hypot(b.x - a.x, b.y - a.y);
        scalePts.current = [];
        setScaleMode(false);
        const metres = Number(window.prompt("كم المسافة الحقيقية بين النقطتين بالأمتار؟", "10"));
        if (px > 1 && Number.isFinite(metres) && metres > 0) saveScale(metres / px);
      }
      return;
    }
    if (draggingRef.current) return;
    setSelected(null);
    panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    setPanning(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  const dragStart = useRef<{ px: number; py: number; ix: number; iy: number } | null>(null);
  function onCanvasPointerMove(e: React.PointerEvent) {
    if (draggingRef.current) {
      const id = draggingRef.current;
      const start = dragStart.current;
      if (!start) return;
      const nx = Math.round(start.ix + (e.clientX - start.px) / view.zoom);
      const ny = Math.round(start.iy + (e.clientY - start.py) / view.zoom);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, x: nx, y: ny } : i)));
      return;
    }
    if (panRef.current) {
      setView((v) => ({ ...v, tx: panRef.current!.tx + (e.clientX - panRef.current!.x), ty: panRef.current!.ty + (e.clientY - panRef.current!.y) }));
    }
  }
  function onCanvasPointerUp() {
    if (draggingRef.current) {
      const id = draggingRef.current;
      const it = items.find((i) => i.id === id);
      draggingRef.current = null;
      dragStart.current = null;
      if (it) patchItem(id, { x: it.x, y: it.y });
      return;
    }
    panRef.current = null;
    setPanning(false);
  }
  function onItemPointerDown(e: React.PointerEvent, it: LayoutItemRow) {
    if (scaleMode) return;
    e.stopPropagation();
    setSelected(it.id);
    if (!canEdit) return;
    draggingRef.current = it.id;
    dragStart.current = { px: e.clientX, py: e.clientY, ix: it.x, iy: it.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onWheel(e: React.WheelEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView((v) => {
      const zoom = Math.min(4, Math.max(0.05, v.zoom * factor));
      return { zoom, tx: mx - (mx - v.tx) * (zoom / v.zoom), ty: my - (my - v.ty) * (zoom / v.zoom) };
    });
  }

  const sel = items.find((i) => i.id === selected) ?? null;
  const tables = items.filter((i) => TABLE_KINDS.has(i.kind)).length;
  const seats = items.filter((i) => SEAT_KINDS.has(i.kind)).length;
  const zoomBy = (f: number) => setView((v) => ({ ...v, zoom: Math.min(4, Math.max(0.05, v.zoom * f)) }));
  const metres = (px: number) => (scale ? (px * scale).toFixed(1) : null);

  return (
    <div className="flex h-dvh flex-col bg-[#0b1120] text-slate-200">
      <header className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2 text-sm">
        <Link href={`/projects/${projectId}/layouts`} className="text-slate-400 hover:text-white">المخططات</Link>
        <ChevronRight size={14} className="text-slate-600" />
        <span className="truncate font-medium text-white">{layout.name}</span>
        <span className="ml-auto hidden text-xs text-slate-500 md:inline">{projectName}</span>
        {canEdit && bg.path && (
          <button
            onClick={() => { setScaleMode((s) => !s); scalePts.current = []; }}
            className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${scaleMode ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
          >
            <Ruler size={13} /> {scale ? `${(1 / scale).toFixed(0)} px/م` : "ضبط المقياس"}
          </button>
        )}
        <div className="ml-1 flex items-center gap-1">
          <button onClick={() => zoomBy(1 / 1.2)} aria-label="تصغير" className="rounded border border-slate-700 p-1 hover:bg-slate-800"><Minus size={14} /></button>
          <span className="w-10 text-center text-xs text-slate-400">{Math.round(view.zoom * 100)}%</span>
          <button onClick={() => zoomBy(1.2)} aria-label="تكبير" className="rounded border border-slate-700 p-1 hover:bg-slate-800"><Plus size={14} /></button>
        </div>
      </header>

      <div dir="rtl" className="flex min-h-0 flex-1">
        {canEdit && (
          <aside className="w-48 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-950 p-2 text-xs">
            {/* Seating generators */}
            <p className="px-1 pb-1 font-semibold text-slate-300">توزيع الجلوس</p>
            <div className="mb-2 space-y-1.5 rounded-lg border border-slate-800 bg-slate-900 p-2">
              <div className="flex items-center gap-1">
                <input type="number" min={1} max={20} value={seatsPerTable} onChange={(e) => setSeatsPerTable(Number(e.target.value))} className="w-12 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-center" />
                <button onClick={addSeatedTable} disabled={!bg.path} className="flex-1 rounded bg-emerald-600/90 px-2 py-1 font-medium text-white hover:bg-emerald-600 disabled:opacity-40">طاولة + كراسي</button>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" min={1} max={40} value={rowLen} onChange={(e) => setRowLen(Number(e.target.value))} className="w-12 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-center" />
                <button onClick={addRow} disabled={!bg.path} className="flex-1 rounded bg-slate-700 px-2 py-1 font-medium text-white hover:bg-slate-600 disabled:opacity-40">صف كراسي</button>
              </div>
            </div>

            {/* Categorised asset palette */}
            {CATEGORY_ORDER.map((cat) => (
              <div key={cat} className="mb-2">
                <p className="px-1 pb-1 font-semibold text-slate-400">{CATEGORY_LABEL[cat]}</p>
                <div className="grid grid-cols-1 gap-1">
                  {LAYOUT_ASSETS.filter((a) => a.category === cat).map((a) => (
                    <button key={a.kind} onClick={() => addAsset(a.kind)} disabled={!bg.path}
                      className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-right text-slate-200 hover:border-emerald-700 disabled:opacity-40">
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: a.color }} />
                      <span className="truncate">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!bg.path && <p className="px-1 text-[11px] text-amber-400">ارفع مخطط القاعة أولاً</p>}
          </aside>
        )}

        {/* Canvas */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <svg
            ref={svgRef}
            className="h-full w-full touch-none select-none"
            style={{ cursor: scaleMode ? "crosshair" : panning ? "grabbing" : "default" }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onWheel={onWheel}
          >
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.zoom})`}>
              {bgUrl && bg.w && bg.h && <image href={bgUrl} x={0} y={0} width={bg.w} height={bg.h} />}
              {items.map((it) => {
                const cx = it.x + it.w / 2;
                const cy = it.y + it.h / 2;
                const isSel = it.id === selected;
                return (
                  <g key={it.id} transform={`translate(${cx} ${cy}) rotate(${it.rotation})`} onPointerDown={(e) => onItemPointerDown(e, it)} style={{ cursor: canEdit ? "move" : "pointer" }}>
                    <rect x={-it.w / 2} y={-it.h / 2} width={it.w} height={it.h} fill="transparent" />
                    <LayoutBlock kind={it.kind} w={it.w} h={it.h} color={it.color} />
                    {it.label && it.kind !== "restroom" && (
                      <text textAnchor="middle" dominantBaseline="central" fontSize={Math.max(9, Math.min(it.w, it.h) * 0.32)} fill="#1f2937" fontWeight="700" style={{ pointerEvents: "none" }}>
                        {it.label.length > 16 ? it.label.slice(0, 15) + "…" : it.label}
                      </text>
                    )}
                    {isSel && (
                      <rect x={-it.w / 2} y={-it.h / 2} width={it.w} height={it.h} fill="none" stroke="#10b981" strokeWidth={1.8} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {scaleMode && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-emerald-600/90 px-3 py-1 text-xs text-white">
              اضغط نقطتين على مسافة معروفة لضبط المقياس
            </div>
          )}

          {/* Scale bar */}
          {scale && bg.path && (
            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded bg-slate-900/80 px-2 py-1 text-[11px] text-slate-300">
              <span>5 م</span>
              <span className="inline-block h-1.5 border-x border-slate-300 bg-slate-300/40" style={{ width: `${(5 / scale) * view.zoom}px` }} />
            </div>
          )}

          {/* Templates (empty + has background) */}
          {bg.path && canEdit && items.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs">
                <span className="text-slate-400">ابدأ من قالب:</span>
                {LAYOUT_TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => insertDrafts(t.build())} className="rounded-md bg-slate-700 px-2.5 py-1 text-slate-100 hover:bg-emerald-600">{t.name}</button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state: upload */}
          {!bg.path && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto card max-w-sm p-6 text-center">
                <Upload className="mx-auto mb-3 text-emerald-400" size={28} />
                <h3 className="font-semibold text-white">ارفع مخطط القاعة</h3>
                <p className="mb-4 mt-1 text-xs text-slate-400">صورة المخطط (JPG/PNG/WebP حتى 25MB) تكون خلفية توزّع عليها العناصر.</p>
                {canEdit ? (
                  <label className="btn-primary inline-flex cursor-pointer items-center gap-2">
                    {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    {uploading ? "جارٍ الرفع…" : "اختر صورة"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadBackground(e.target.files[0])} />
                  </label>
                ) : (
                  <p className="text-xs text-slate-500">لا يوجد مخطط بعد.</p>
                )}
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
              </div>
            </div>
          )}

          {bg.path && canEdit && (
            <label className="absolute bottom-3 left-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 text-xs text-slate-300 hover:border-emerald-700">
              {uploading ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />} تبديل المخطط
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadBackground(e.target.files[0])} />
            </label>
          )}
        </div>

        {/* Selected item panel */}
        {sel && (
          <aside dir="rtl" className="w-60 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{assetOf(sel.kind).label}</h3>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <button onClick={() => duplicateItem(sel)} aria-label="تكرار" className="text-slate-500 hover:text-emerald-400"><Copy size={15} /></button>
                  <button onClick={() => removeItem(sel.id)} aria-label="حذف" className="text-slate-500 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              )}
            </div>
            {canEdit ? (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="label" htmlFor="it-label">التسمية</label>
                  <input id="it-label" defaultValue={sel.label} className="field" onBlur={(e) => patchItem(sel.id, { label: e.target.value.slice(0, 60) })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor="it-w">العرض</label>
                    <input id="it-w" type="number" min={8} defaultValue={Math.round(sel.w)} className="field" onBlur={(e) => patchItem(sel.id, { w: Math.max(8, Number(e.target.value) || sel.w) })} />
                  </div>
                  <div>
                    <label className="label" htmlFor="it-h">الارتفاع</label>
                    <input id="it-h" type="number" min={8} defaultValue={Math.round(sel.h)} className="field" onBlur={(e) => patchItem(sel.id, { h: Math.max(8, Number(e.target.value) || sel.h) })} />
                  </div>
                </div>
                {scale && (
                  <p className="rounded bg-slate-900 px-2 py-1 text-xs text-slate-400">
                    الأبعاد الحقيقية: {metres(sel.w)} × {metres(sel.h)} م
                    {` · المساحة ${(sel.w * sel.h * scale * scale).toFixed(1)} م²`}
                  </p>
                )}
                <div>
                  <label className="label" htmlFor="it-rot">الدوران: {Math.round(sel.rotation)}°</label>
                  <input id="it-rot" type="range" min={0} max={360} defaultValue={sel.rotation} className="w-full"
                    onChange={(e) => setItems((prev) => prev.map((i) => (i.id === sel.id ? { ...i, rotation: Number(e.target.value) } : i)))}
                    onPointerUp={(e) => patchItem(sel.id, { rotation: Number((e.target as HTMLInputElement).value) })} />
                </div>
                <div>
                  <label className="label" htmlFor="it-color">اللون</label>
                  <input id="it-color" type="color" defaultValue={sel.color} className="h-8 w-full rounded border border-slate-700 bg-slate-900" onChange={(e) => patchItem(sel.id, { color: e.target.value })} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-300">{sel.label}</p>
            )}
          </aside>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-x-4 border-t border-slate-800 bg-slate-950 px-3 py-1.5 text-center text-[11px] text-slate-500">
        <span>{items.length} عنصر</span>
        <span>{tables} طاولة</span>
        <span>{seats} كرسي</span>
        {!scale && <span className="text-amber-500/80">المقياس غير مضبوط</span>}
        <span className="hidden sm:inline">{canEdit ? "اسحب العناصر · مرّر للتكبير · اسحب الفراغ للتحريك" : `عرض فقط — ${email}`}</span>
      </footer>
    </div>
  );
}
