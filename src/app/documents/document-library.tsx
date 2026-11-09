"use client";

import { useCallback, useState, useTransition } from "react";
import { Download, FileUp, History, Lock, Pencil, Trash2, Upload } from "lucide-react";
import { DOCUMENT_CATEGORY_LABEL, type DocumentListItem, type DocumentScope } from "@/lib/documents";
import { deleteDocument, documentDownloadUrl } from "./actions";
import { EditForm, UploadForm } from "./document-forms";
import { Modal } from "./modal";

type Status = { tone: "ok" | "error" | "info"; text: string } | null;
type Dialog =
  | { kind: "upload" }
  | { kind: "version"; item: DocumentListItem }
  | { kind: "edit"; item: DocumentListItem }
  | { kind: "history"; item: DocumentListItem };

/** Secondary columns: on phones their content moves into a summary line under the title. */
const WIDE = "hidden sm:table-cell";
/** Shown before the download transition starts (updates inside a transition wait for its end). */
const PREPARING: Status = { tone: "info", text: "جارٍ تجهيز رابط التنزيل…" };

/** Asks for a one-minute signed link and hands it to the browser, which saves the file. */
async function startDownload(id: string, report: (status: Status) => void) {
  try {
    const { url, error } = await documentDownloadUrl(id);
    if (!url) return report({ tone: "error", text: error ?? "تعذّر تنزيل الملف." });
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noopener";
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    report({ tone: "ok", text: "بدأ تنزيل الملف. ينتهي الرابط بعد دقيقة." });
  } catch {
    report({ tone: "error", text: "تعذّر تنزيل الملف. حاول مجددًا." });
  }
}

function StatusLine({ status }: { status: Status }) {
  return (
    <>
      <p role="status" className={`text-sm ${status?.tone === "info" ? "text-slate-300" : "text-emerald-300"}`}>
        {status && status.tone !== "error" ? status.text : ""}
      </p>
      {status?.tone === "error" && <p role="alert" className="text-sm text-red-400">{status.text}</p>}
    </>
  );
}

export function DocumentLibrary({
  items,
  showProject,
  upload,
  emptyText,
}: {
  items: DocumentListItem[];
  /** Adds the project column (organisation library). */
  showProject: boolean;
  /** Where new documents go, or null when the viewer may not upload here. */
  upload: { scope: DocumentScope; canMarkConfidential: boolean } | null;
  emptyText: string;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const close = useCallback(() => setDialog(null), []);
  const done = useCallback((text: string) => {
    setDialog(null);
    setStatus({ tone: "ok", text });
  }, []);

  return (
    <section className="space-y-3" aria-label="قائمة المستندات">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{items.length === 1 ? "مستند واحد" : `${items.length} مستند`}</p>
        {upload && (
          <button type="button" className="btn-primary" onClick={() => setDialog({ kind: "upload" })}>
            <Upload size={16} aria-hidden /> رفع مستند
          </button>
        )}
      </div>
      <StatusLine status={status} />

      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">{emptyText}</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-right text-sm sm:min-w-[780px]">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th scope="col" className="px-3 py-2 font-medium">المستند</th>
                {showProject && <th scope="col" className={`px-3 py-2 font-medium ${WIDE}`}>المشروع</th>}
                <th scope="col" className={`px-3 py-2 font-medium ${WIDE}`}>التصنيف</th>
                <th scope="col" className={`px-3 py-2 font-medium ${WIDE}`}>الإصدار</th>
                <th scope="col" className={`px-3 py-2 font-medium ${WIDE}`}>الحجم</th>
                <th scope="col" className={`px-3 py-2 font-medium ${WIDE}`}>رفعه</th>
                <th scope="col" className={`px-3 py-2 font-medium ${WIDE}`}>التاريخ</th>
                <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">الإجراءات</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item) => (
                <DocumentRowView key={item.id} item={item} showProject={showProject} onOpen={setDialog} onStatus={setStatus} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === "upload" && upload && (
        <Modal title="رفع مستند" description={upload.scope.projectId ? "يُضاف إلى مستندات هذا المشروع." : "مستند على مستوى المنظمة، لا يخص مشروعًا بعينه."} onClose={close}>
          <UploadForm target={upload} onDone={done} onCancel={close} />
        </Modal>
      )}
      {dialog?.kind === "version" && (
        <Modal title="رفع إصدار جديد" description={`يحلّ محل الإصدار ${dialog.item.version} من «${dialog.item.title}»، ويبقى السابق في سجل الإصدارات.`} onClose={close}>
          <UploadForm
            target={{
              scope: { organizationId: dialog.item.organizationId, projectId: dialog.item.projectId },
              canMarkConfidential: dialog.item.canMarkConfidential,
              previous: dialog.item,
            }}
            onDone={done}
            onCancel={close}
          />
        </Modal>
      )}
      {dialog?.kind === "edit" && (
        <Modal title="تعديل المستند" description={`الإصدار ${dialog.item.version} · ${dialog.item.fileName}`} onClose={close}>
          <EditForm item={dialog.item} onDone={done} onCancel={close} />
        </Modal>
      )}
      {dialog?.kind === "history" && (
        <Modal title="سجل الإصدارات" description={dialog.item.title} onClose={close}>
          <VersionHistory item={dialog.item} />
        </Modal>
      )}
    </section>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-50 ${danger ? "hover:text-red-400" : "hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function ConfidentialBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-200">
      <Lock size={11} aria-hidden /> سرّي
    </span>
  );
}

function DocumentRowView({
  item,
  showProject,
  onOpen,
  onStatus,
}: {
  item: DocumentListItem;
  showProject: boolean;
  onOpen: (dialog: Dialog) => void;
  onStatus: (status: Status) => void;
}) {
  const [busy, start] = useTransition();

  function remove() {
    const ok = window.confirm(`حذف «${item.title}» (الإصدار ${item.version})؟ سيُحذف الملف نهائيًا ولا يمكن التراجع.`);
    if (!ok) return;
    start(async () => {
      try {
        const result = await deleteDocument(item.id);
        if (result.error || !result.ok) onStatus({ tone: "error", text: result.error ?? "تعذّر الحذف." });
        // Announce it in the same render that drops the row (refresh() in the action).
        else start(() => onStatus({ tone: "ok", text: `تم حذف «${item.title}».` }));
      } catch {
        onStatus({ tone: "error", text: "تعذّر الحذف. حاول مجددًا." });
      }
    });
  }

  return (
    <tr data-testid="document-row" className="align-top text-slate-200">
      <td className="px-3 py-3 sm:max-w-72">
        <p className="font-medium wrap-anywhere text-white">{item.title}</p>
        <p className="mt-0.5 text-xs wrap-anywhere text-slate-500" dir="auto">{item.fileName}</p>
        {item.description && <p className="mt-1 line-clamp-2 text-xs wrap-anywhere text-slate-400">{item.description}</p>}
        {/* Phones: the secondary columns, condensed. */}
        <p className="mt-1 text-xs text-slate-400 sm:hidden">
          <span className="whitespace-nowrap">{DOCUMENT_CATEGORY_LABEL[item.category]}</span> ·{" "}
          <span className="whitespace-nowrap"><span dir="ltr">v{item.version}</span>{!item.isLatest && " (إصدار سابق)"}</span> ·{" "}
          <span dir="ltr" className="whitespace-nowrap">{item.size}</span> · <span dir="ltr" className="whitespace-nowrap">{item.uploadedAt}</span>
          {showProject && (
            <span className="block">{item.projectId ? <span dir="auto">{item.projectLabel ?? "مشروع"}</span> : "مستند المنظمة"}</span>
          )}
        </p>
        {item.isConfidential && <p className="mt-1"><ConfidentialBadge /></p>}
      </td>
      {showProject && (
        <td className={`px-3 py-3 text-xs text-slate-300 ${WIDE}`}>
          {item.projectId ? <span dir="auto">{item.projectLabel ?? "مشروع"}</span> : "المنظمة"}
        </td>
      )}
      <td className={`px-3 py-3 text-xs ${WIDE}`}>{DOCUMENT_CATEGORY_LABEL[item.category]}</td>
      <td className={`px-3 py-3 text-xs ${WIDE}`}>
        <span className="font-mono" aria-label={`الإصدار ${item.version}`}>v{item.version}</span>
        {!item.isLatest && <span className="block text-[11px] text-slate-500">إصدار سابق</span>}
      </td>
      <td className={`whitespace-nowrap px-3 py-3 text-xs ${WIDE}`}><span dir="ltr">{item.size}</span></td>
      <td className={`px-3 py-3 text-xs ${WIDE}`}><span dir="ltr" className="wrap-anywhere">{item.uploadedBy}</span></td>
      <td className={`whitespace-nowrap px-3 py-3 text-xs ${WIDE}`}><span dir="ltr">{item.uploadedAt}</span></td>
      <td className="px-2 py-2 sm:px-3">
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            label={`تنزيل ${item.title}`}
            disabled={busy}
            onClick={() => {
              onStatus(PREPARING);
              start(() => startDownload(item.id, onStatus));
            }}
          >
            <Download size={15} aria-hidden />
          </IconButton>
          <IconButton label={`سجل إصدارات ${item.title}`} onClick={() => onOpen({ kind: "history", item })}>
            <History size={15} aria-hidden />
            {item.history.length > 1 && <span className="text-[11px]" aria-hidden>{item.history.length}</span>}
          </IconButton>
          {item.canWrite && item.isLatest && (
            <IconButton label={`رفع إصدار جديد من ${item.title}`} disabled={busy} onClick={() => onOpen({ kind: "version", item })}>
              <FileUp size={15} aria-hidden />
            </IconButton>
          )}
          {item.canWrite && (
            <IconButton label={`تعديل ${item.title}`} disabled={busy} onClick={() => onOpen({ kind: "edit", item })}>
              <Pencil size={15} aria-hidden />
            </IconButton>
          )}
          {item.canWrite && (
            <IconButton label={`حذف ${item.title}`} disabled={busy} danger onClick={remove}>
              <Trash2 size={15} aria-hidden />
            </IconButton>
          )}
        </div>
      </td>
    </tr>
  );
}

function VersionHistory({ item }: { item: DocumentListItem }) {
  const [busy, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  const newest = item.history[0]?.id;
  return (
    <div className="space-y-2">
      <ol className="divide-y divide-slate-800" aria-label="الإصدارات من الأحدث إلى الأقدم">
        {item.history.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm" data-testid="version-entry">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-white">
                <span>الإصدار {v.version}</span>
                {v.id === newest && <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[11px] text-emerald-200">الأحدث</span>}
                {v.id === item.id && v.id !== newest && <span className="text-[11px] text-slate-500">(المعروض)</span>}
                {v.isConfidential && <ConfidentialBadge />}
              </p>
              <p className="mt-0.5 text-xs wrap-anywhere text-slate-400">{v.title}</p>
              <p className="mt-0.5 text-xs wrap-anywhere text-slate-500">
                <span dir="auto">{v.fileName}</span> · <span dir="ltr">{v.size}</span> · <span dir="ltr">{v.uploadedBy}</span> ·{" "}
                <span dir="ltr">{v.uploadedAt}</span>
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost py-1 text-xs"
              disabled={busy}
              aria-label={`تنزيل الإصدار ${v.version}`}
              onClick={() => {
                setStatus(PREPARING);
                start(() => startDownload(v.id, setStatus));
              }}
            >
              <Download size={14} aria-hidden /> تنزيل
            </button>
          </li>
        ))}
      </ol>
      <StatusLine status={status} />
    </div>
  );
}
