"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * A modal built on the native <dialog>: the browser traps focus inside it, makes the page behind
 * it inert, closes it on Escape and returns focus to the control that opened it.
 *
 * It opens on mount. Closing (Escape, the close button, or unmounting) goes through
 * dialog.close() while the element is still in the document, so focus is restored.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // A layout effect: its cleanup runs before React removes the element, so close() can still
  // return focus to the opener.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // The close event is queued, not dispatched at once: ignore a stale one that arrives after the
    // dialog was opened again (React's development double-mount closes and reopens it).
    const handleClose = () => {
      if (!dialog.open) onCloseRef.current();
    };
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      dir="rtl"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-auto w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-black/60"
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-semibold text-white">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 break-words text-xs text-slate-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="إغلاق"
            className="shrink-0 rounded p-1 text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
