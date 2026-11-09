"use client";

import { useId, useState, useTransition } from "react";
import { Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DOCUMENTS_BUCKET,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  buildDocumentPath,
  newUuid,
  storageErrorMessage,
  validateDocumentFields,
  validateUploadMeta,
  type DocumentListItem,
  type DocumentScope,
} from "@/lib/documents";
import type { DocumentCategory } from "@/lib/types";
import { createDocument, updateDocument, type DocumentActionState, type UpdateDocumentInput } from "./actions";

export type UploadTarget = {
  scope: DocumentScope;
  /** Shows the confidential option (finance access in this organisation). */
  canMarkConfidential: boolean;
  /** Set when the upload is a new version of this document. */
  previous?: Pick<DocumentListItem, "id" | "title" | "category" | "description" | "isConfidential" | "version">;
};

const UNEXPECTED = "حدث خطأ غير متوقع. حاول مجددًا.";

/**
 * Uploads a file straight from the browser to the private `documents` bucket (Server Actions
 * accept at most 1 MB), then asks the server to register it. If that fails, the uploaded object
 * is removed again.
 */
export function UploadForm({ target, onDone, onCancel }: { target: UploadTarget; onDone: (message: string) => void; onCancel: () => void }) {
  const { scope, canMarkConfidential, previous } = target;
  const ids = useFieldIds();
  const [fileName, setFileName] = useState<string | null>(null);
  const [title, setTitle] = useState(previous?.title ?? "");
  // A new document takes its title from the file name until the person types their own.
  const [titleFollowsFile, setTitleFollowsFile] = useState(!previous);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, startSaving] = useTransition();
  const pending = uploading || saving;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) return setError("اختر ملفًا للرفع.");
    const meta = validateUploadMeta({ fileName: file.name, mimeType: file.type, size: file.size });
    if (!meta.ok) return setError(meta.error);
    const fields = validateDocumentFields(
      { title: form.get("title"), category: form.get("category"), description: form.get("description") },
      meta.value.fileName,
    );
    if (!fields.ok) return setError(fields.error);
    const confidential = canMarkConfidential && form.get("confidential") === "on";

    // 1. The file goes straight to Storage.
    setError(null);
    setUploading(true);
    setProgress("جارٍ رفع الملف…");
    const supabase = createClient();
    const path = buildDocumentPath(scope, newUuid(), meta.value.fileName);
    try {
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: meta.value.mimeType, upsert: false });
      if (uploadError) {
        setProgress(null);
        setError(storageErrorMessage(uploadError) ?? UNEXPECTED);
        return;
      }
    } catch {
      setProgress(null);
      setError("تعذّر رفع الملف. تحقّق من اتصالك وحاول مجددًا.");
      return;
    } finally {
      setUploading(false);
    }

    // 2. The server registers it. Running the action in a transition lets the dialog close in the
    // same render as the refreshed list (refresh() in the action), not a frame before it.
    setProgress("جارٍ حفظ بيانات المستند…");
    startSaving(async () => {
      let result: DocumentActionState;
      try {
        result = await createDocument({
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          path,
          ...fields.value,
          confidential,
          ...meta.value,
          supersedesId: previous?.id ?? null,
        });
      } catch {
        result = { error: UNEXPECTED };
      }
      if (result.ok && !result.error) {
        const message = previous ? `تم رفع الإصدار ${previous.version + 1} من «${fields.value.title}».` : `تم رفع «${fields.value.title}».`;
        startSaving(() => onDone(message));
        return;
      }
      // No row points at the file: remove it so nothing is left behind.
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => undefined);
      setProgress(null);
      setError(result.error ?? UNEXPECTED);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" aria-busy={pending} noValidate>
      <div>
        <span id={ids.fileLabel} className="label">الملف</span>
        <div className="flex flex-wrap items-center gap-3">
          {/* The real input stays focusable for keyboards and screen readers; the label beside it is the visible button. */}
          <input
            id={ids.file}
            name="file"
            type="file"
            aria-labelledby={ids.fileLabel}
            aria-describedby={`${ids.fileName} ${ids.fileHint}`}
            aria-required="true"
            disabled={pending}
            onChange={(e) => {
              const picked = e.currentTarget.files?.[0];
              setFileName(picked?.name ?? null);
              if (picked && titleFollowsFile) setTitle(picked.name.slice(0, MAX_TITLE_LENGTH));
            }}
            className="peer sr-only"
          />
          <label
            htmlFor={ids.file}
            className="btn-ghost cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
          >
            <Paperclip size={15} aria-hidden /> {fileName ? "تغيير الملف" : "اختر ملفًا"}
          </label>
          <span id={ids.fileName} dir="auto" className="min-w-0 flex-1 text-sm wrap-anywhere text-slate-300">
            {fileName ?? <span className="text-slate-500">لم يُختر ملف بعد</span>}
          </span>
        </div>
        <p id={ids.fileHint} className="mt-1 text-xs text-slate-500">حتى 50 ميجابايت. يُحفظ في مساحة خاصة، ويُنزَّل برابط مؤقت فقط.</p>
      </div>
      <div>
        <label className="label" htmlFor={ids.title}>العنوان</label>
        <input
          id={ids.title}
          name="title"
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="اسم الملف إن تركته فارغًا"
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleFollowsFile(false);
          }}
          className="field"
        />
      </div>
      <CategoryField id={ids.category} defaultValue={previous?.category} />
      <DescriptionField id={ids.description} defaultValue={previous?.description} />
      {canMarkConfidential && <ConfidentialField id={ids.confidential} hintId={ids.confidentialHint} defaultChecked={previous?.isConfidential} />}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <p role="status" className="text-sm text-slate-400">{progress}</p>
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {/* Closing the dialog does not stop an upload already under way; its result is still announced. */}
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={pending}>إلغاء</button>
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "جارٍ الرفع…" : "رفع"}</button>
      </div>
    </form>
  );
}

/** Title, category, description and (for finance users) the confidential flag of one version. */
export function EditForm({ item, onDone, onCancel }: { item: DocumentListItem; onDone: (message: string) => void; onCancel: () => void }) {
  const ids = useFieldIds();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const input: UpdateDocumentInput = {
      title: String(form.get("title") ?? ""),
      category: String(form.get("category") ?? ""),
      description: String(form.get("description") ?? ""),
    };
    if (item.canMarkConfidential) input.confidential = form.get("confidential") === "on";
    const check = validateDocumentFields(input);
    if (!check.ok) return setError(check.error);
    setError(null);
    start(async () => {
      try {
        const result = await updateDocument(item.id, input);
        if (result.error || !result.ok) setError(result.error ?? UNEXPECTED);
        // Close together with the refreshed list, as part of the same transition.
        else start(() => onDone("تم حفظ التعديلات."));
      } catch {
        setError(UNEXPECTED);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" aria-busy={pending} noValidate>
      <div>
        <label className="label" htmlFor={ids.title}>العنوان</label>
        <input id={ids.title} name="title" aria-required="true" defaultValue={item.title} maxLength={MAX_TITLE_LENGTH} className="field" />
      </div>
      <CategoryField id={ids.category} defaultValue={item.category} />
      <DescriptionField id={ids.description} defaultValue={item.description} />
      {item.canMarkConfidential && <ConfidentialField id={ids.confidential} hintId={ids.confidentialHint} defaultChecked={item.isConfidential} />}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onCancel}>إلغاء</button>
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
    </form>
  );
}

function useFieldIds() {
  const base = useId();
  return {
    file: `${base}-file`,
    fileLabel: `${base}-file-label`,
    fileName: `${base}-file-name`,
    fileHint: `${base}-file-hint`,
    title: `${base}-title`,
    category: `${base}-category`,
    description: `${base}-description`,
    confidential: `${base}-confidential`,
    confidentialHint: `${base}-confidential-hint`,
  };
}

function CategoryField({ id, defaultValue = "other" }: { id: string; defaultValue?: DocumentCategory }) {
  return (
    <div>
      <label className="label" htmlFor={id}>التصنيف</label>
      <select id={id} name="category" defaultValue={defaultValue} className="field">
        {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABEL[c]}</option>)}
      </select>
    </div>
  );
}

function DescriptionField({ id, defaultValue = "" }: { id: string; defaultValue?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>الوصف</label>
      <textarea id={id} name="description" rows={3} defaultValue={defaultValue} maxLength={MAX_DESCRIPTION_LENGTH} className="field" />
    </div>
  );
}

function ConfidentialField({ id, hintId, defaultChecked = false }: { id: string; hintId: string; defaultChecked?: boolean }) {
  return (
    <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3">
      <div className="flex items-center gap-2">
        <input id={id} name="confidential" type="checkbox" defaultChecked={defaultChecked} aria-describedby={hintId} className="size-4 accent-amber-400" />
        <label htmlFor={id} className="text-sm font-medium text-amber-100">مستند سرّي</label>
      </div>
      <p id={hintId} className="mt-1 text-xs text-amber-200/70">لا يراه إلا مدير المنظمة ومن لديه صلاحية المالية، مثل العقود المسعّرة.</p>
    </div>
  );
}
