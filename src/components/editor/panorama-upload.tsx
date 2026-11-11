"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function PanoramaUpload({
  at,
  onCancel,
  onUpload,
}: {
  at: { lng: number; lat: number };
  onCancel: () => void;
  onUpload: (input: { file: File; title: string }) => Promise<boolean>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  async function inspect(f: File | null) {
    setFile(f);
    setWarning(null);
    if (!f) return;
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      if (Math.abs(ratio - 2) > 0.1) {
        setWarning(
          `This image is ${img.naturalWidth}×${img.naturalHeight}. 360° photos are usually twice as wide as they are tall, so it may look stretched.`,
        );
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file || !title.trim()) return;
          setBusy(true);
          const ok = await onUpload({ file, title: title.trim() });
          setBusy(false);
          if (ok) onCancel();
        }}
        className="card w-full max-w-md space-y-4 bg-slate-900 p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-100">Add a 360° photo</h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-slate-400 hover:text-slate-100">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Pinned at {at.lat.toFixed(5)}, {at.lng.toFixed(5)}. Use an equirectangular JPEG, PNG or WebP up to 50 MB.
        </p>
        <div>
          <label className="label" htmlFor="pano-file">Photo</label>
          <input
            id="pano-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(e) => inspect(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100"
          />
        </div>
        {warning && <p className="text-xs text-amber-300">{warning}</p>}
        <div>
          <label className="label" htmlFor="pano-title">Title</label>
          <input
            id="pano-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. North stand, row 1"
            className="field"
          />
        </div>
        <button className="btn-primary w-full" disabled={busy || !file || !title.trim()}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );
}
