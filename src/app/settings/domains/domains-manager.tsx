"use client";

import { useActionState, useCallback, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addDomain, removeDomain, type DomainFormState } from "./actions";

export type DomainEntry = { domain: string; addedOn: string; primary: boolean };

/** Lists, adds and removes the organisation's email domains (admins only). */
export function DomainsManager({ domains }: { domains: DomainEntry[] }) {
  const [state, action, pending] = useActionState<DomainFormState, FormData>(addDomain, {});
  // The latest removal, tagged with the add-form version it followed, so only the newest message shows.
  const [removal, setRemoval] = useState<{ message: string; after: number } | null>(null);
  const version = state.version ?? 0;
  const removedLast = removal !== null && removal.after === version;

  return (
    <div className="mt-6 space-y-5">
      <form action={action} noValidate className="card p-5" aria-labelledby="add-domain-title">
        <h2 id="add-domain-title" className="font-semibold text-white">إضافة نطاق</h2>
        <label htmlFor="new-domain" className="label mt-3">نطاق جديد</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            key={version}
            id="new-domain"
            name="domain"
            defaultValue={state.value ?? ""}
            required
            dir="ltr"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="example.com"
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "new-domain-hint new-domain-error" : "new-domain-hint"}
            className="field"
          />
          <button type="submit" className="btn-primary shrink-0" disabled={pending}>
            <Plus size={15} aria-hidden /> إضافة النطاق
          </button>
        </div>
        <p id="new-domain-hint" className="mt-1 text-xs text-slate-500">
          اكتب النطاق فقط بأحرف لاتينية صغيرة، مثل <bdi dir="ltr">example.com</bdi>. إن لصقت بريدًا إلكترونيًا
          كاملًا يُؤخذ النطاق منه.
        </p>
        {state.error && !pending && (
          <p id="new-domain-error" className="mt-2 text-sm text-red-400" role="alert">{state.error}</p>
        )}
        {state.message && !pending && !removedLast && (
          <p className="mt-2 text-sm text-emerald-400" role="status">{state.message}</p>
        )}
      </form>

      <section className="card overflow-hidden" aria-labelledby="domains-title">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-3">
          <h2 id="domains-title" className="font-semibold text-white">النطاقات المسجّلة</h2>
          <span className="text-xs text-slate-500">{domains.length}</span>
        </div>
        {domains.length ? (
          <ul className="divide-y divide-slate-800">
            {domains.map((d) => (
              <DomainRow key={d.domain} entry={d} onRemoved={(message) => setRemoval({ message, after: version })} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-400">لا توجد نطاقات بعد، فلن ينضم أحد تلقائيًا حتى تضيف نطاقًا.</p>
        )}
        {removedLast && (
          <p className="border-t border-slate-800 px-5 py-3 text-sm text-emerald-400" role="status">{removal.message}</p>
        )}
      </section>
    </div>
  );
}

function DomainRow({ entry, onRemoved }: { entry: DomainEntry; onRemoved: (message: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const returnFocus = useRef(false);

  // Keyboard focus follows the confirmation step: into it when it opens, back when it is cancelled.
  const focusOnMount = useCallback((el: HTMLButtonElement | null) => el?.focus(), []);
  const removeButton = useCallback((el: HTMLButtonElement | null) => {
    if (el && returnFocus.current) {
      returnFocus.current = false;
      el.focus();
    }
  }, []);

  const cancel = () => {
    returnFocus.current = true;
    setConfirming(false);
  };

  const remove = () =>
    start(async () => {
      setError(null);
      const result = await removeDomain(entry.domain);
      if (result.error) setError(result.error);
      else onRemoved(result.message ?? "");
    });

  return (
    <li data-testid="domain-row" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="break-all font-medium text-slate-100"><bdi dir="ltr">{entry.domain}</bdi></p>
        <p className="mt-0.5 text-xs text-slate-500">
          أُضيف {entry.addedOn}
          {entry.primary && " · النطاق الأساسي للمنظمة"}
        </p>
      </div>
      {confirming ? (
        <div
          role="group"
          aria-label={`تأكيد إزالة ${entry.domain}`}
          className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) cancel();
          }}
        >
          <p className="w-full text-xs text-amber-200 sm:w-auto">لن ينضم الجدد بهذا النطاق تلقائيًا، ويبقى الأعضاء الحاليون.</p>
          <button ref={focusOnMount} type="button" className="btn-danger" disabled={busy} onClick={remove}>
            {busy ? "جارٍ الإزالة…" : "تأكيد الإزالة"}
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={cancel}>إلغاء</button>
        </div>
      ) : (
        <button
          ref={removeButton}
          type="button"
          className="btn-ghost text-red-300 hover:text-red-200"
          aria-label={`إزالة ${entry.domain}`}
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          <Trash2 size={15} aria-hidden /> إزالة
        </button>
      )}
      {error && <p className="w-full text-xs text-red-400" role="alert">{error}</p>}
    </li>
  );
}
