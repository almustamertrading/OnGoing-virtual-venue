import { permissionMessage, type Access } from "@/lib/permissions";
import type { DocumentCategory, DocumentRow } from "@/lib/types";

/**
 * Central document management: pure rules shared by the upload component, the server actions
 * and the pages. The database enforces access (RLS on `documents`, policies on the private
 * `documents` bucket); these helpers only shape input and decide what to show.
 */

export const DOCUMENTS_BUCKET = "documents";
/** Same limit as the bucket and the size_bytes CHECK constraint. */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
export const MAX_TITLE_LENGTH = 300;
export const MAX_DESCRIPTION_LENGTH = 4000;
export const MAX_FILE_NAME_LENGTH = 300;
/** The object name (last path segment) stays short; the original name is kept in file_name. */
export const MAX_OBJECT_NAME_LENGTH = 100;
const MAX_EXTENSION_LENGTH = 10;
/** Download links are signed for one minute. */
export const SIGNED_URL_SECONDS = 60;
/** Rows loaded per page view (PostgREST returns at most 1000). */
export const MAX_LISTED_DOCUMENTS = 1000;

export const DOCUMENT_CATEGORIES = [
  "contract", "rfp", "proposal", "drawing", "permit", "invoice", "photo", "report", "other",
] as const satisfies readonly DocumentCategory[];

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  contract: "عقد",
  rfp: "كراسة طلب عروض (RFP)",
  proposal: "عرض مقدَّم",
  drawing: "مخطط",
  permit: "تصريح",
  invoice: "فاتورة",
  photo: "صورة",
  report: "تقرير",
  other: "أخرى",
};

export const isDocumentCategory = (value: unknown): value is DocumentCategory =>
  typeof value === "string" && (DOCUMENT_CATEGORIES as readonly string[]).includes(value);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Canonical (lower-case) UUIDs only: Postgres prints them that way, and paths are compared as text. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** A random v4 UUID, also where crypto.randomUUID is missing (plain-HTTP pages). */
export function newUuid(source: Pick<Crypto, "getRandomValues"> & { randomUUID?: () => string } = globalThis.crypto): string {
  if (typeof source.randomUUID === "function") return source.randomUUID();
  const b = source.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Object names and storage paths
// ---------------------------------------------------------------------------

const SAFE_OBJECT_NAME = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/;

/** True for names safeFileName can produce: ASCII letters and digits, single separators between them. */
export function isSafeObjectName(name: string): boolean {
  return name.length <= MAX_OBJECT_NAME_LENGTH && SAFE_OBJECT_NAME.test(name);
}

/** Replaces disallowed characters with "-", merges repeated separators and trims them from the ends. */
function sanitizeSegment(value: string): string {
  return value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/[._-]{2,}/g, (run) => run[0])
    .replace(/^[._-]+|[._-]+$/g, "");
}

/**
 * A storage-safe object name for an uploaded file: only the last path component counts, accents
 * are dropped, anything outside [A-Za-z0-9._-] becomes "-", the extension is kept and the length
 * is limited. Names with nothing usable left (e.g. Arabic-only) become "file" plus the extension;
 * the original name is still stored in file_name and used for downloads.
 */
export function safeFileName(original: string): string {
  const leaf = String(original ?? "").split(/[\\/]/).pop() ?? "";
  const plain = leaf.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const dot = plain.lastIndexOf(".");
  const ext = dot > 0 ? plain.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").slice(0, MAX_EXTENSION_LENGTH) : "";
  const room = MAX_OBJECT_NAME_LENGTH - (ext ? ext.length + 1 : 0);
  let base = sanitizeSegment(dot > 0 ? plain.slice(0, dot) : plain);
  base = base.slice(0, room).replace(/[._-]+$/, "") || "file";
  return ext ? `${base}.${ext}` : base;
}

export type DocumentScope = { organizationId: string; projectId: string | null };

/** `<organization_id>/<project_id | org>`: the folder the CHECK constraint and storage policies expect. */
export function documentFolder(scope: DocumentScope): string {
  return `${scope.organizationId}/${scope.projectId ?? "org"}`;
}

/** `<organization_id>/<project_id | org>/<document id>/<safe file name>`. */
export function buildDocumentPath(scope: DocumentScope, documentId: string, fileName: string): string {
  return `${documentFolder(scope)}/${documentId}/${safeFileName(fileName)}`;
}

export type ParsedDocumentPath = {
  organizationId: string;
  projectId: string | null;
  documentId: string;
  objectName: string;
};

/** Splits a storage path into its four parts, or returns null when it is not a document path. */
export function parseDocumentPath(path: unknown): ParsedDocumentPath | null {
  if (typeof path !== "string" || path.length > 400) return null;
  const parts = path.split("/");
  if (parts.length !== 4) return null;
  const [organizationId, scope, documentId, objectName] = parts;
  if (!isUuid(organizationId) || !isUuid(documentId) || !isSafeObjectName(objectName)) return null;
  if (scope !== "org" && !isUuid(scope)) return null;
  return { organizationId, projectId: scope === "org" ? null : scope, documentId, objectName };
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** The path must be a document path inside the expected organisation and project (or `org`) folder. */
export function validateDocumentPath(path: unknown, scope: DocumentScope): Result<ParsedDocumentPath> {
  const parsed = parseDocumentPath(path);
  if (!parsed) return { ok: false, error: "مسار الملف غير صالح." };
  if (parsed.organizationId !== scope.organizationId || parsed.projectId !== (scope.projectId ?? null)) {
    return { ok: false, error: "الملف المرفوع لا يخص هذه المنظمة أو هذا المشروع." };
  }
  return { ok: true, value: parsed };
}

/**
 * Adds the original file name to a signed URL so the browser saves the file under it.
 * (storage-js double-encodes non-ASCII names passed as `download`, so it is appended here, encoded once.)
 */
export function withDownloadName(signedUrl: string, fileName: string): string {
  const name = fileName.trim() || "download";
  return `${signedUrl}${signedUrl.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`;
}

// ---------------------------------------------------------------------------
// Input validation (shared by the upload component and the server actions)
// ---------------------------------------------------------------------------

export type DocumentFields = { title: string; category: DocumentCategory; description: string };

/** Title (falls back to the file name), category and description, within the database limits. */
export function validateDocumentFields(
  input: { title?: unknown; category?: unknown; description?: unknown },
  fallbackTitle = "",
): Result<DocumentFields> {
  const title = (typeof input.title === "string" ? input.title.trim() : "") || fallbackTitle.trim();
  if (!title) return { ok: false, error: "اكتب عنوانًا للمستند." };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: `العنوان طويل جدًا (${MAX_TITLE_LENGTH} حرف كحد أقصى).` };
  const rawCategory = input.category ?? "";
  const category = rawCategory === "" ? "other" : rawCategory;
  if (!isDocumentCategory(category)) return { ok: false, error: "اختر تصنيفًا من القائمة." };
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { ok: false, error: `الوصف طويل جدًا (${MAX_DESCRIPTION_LENGTH} حرف كحد أقصى).` };
  }
  return { ok: true, value: { title, category, description } };
}

export type UploadMeta = { fileName: string; mimeType: string; size: number };

const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

/** Original file name, MIME type (falls back to application/octet-stream) and size (1 byte to 50 MB). */
export function validateUploadMeta(input: { fileName?: unknown; mimeType?: unknown; size?: unknown }): Result<UploadMeta> {
  const fileName = typeof input.fileName === "string" ? input.fileName.trim().slice(0, MAX_FILE_NAME_LENGTH) : "";
  if (!fileName) return { ok: false, error: "اختر ملفًا للرفع." };
  const size = input.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size < 0) return { ok: false, error: "حجم الملف غير صالح." };
  if (size === 0) return { ok: false, error: "الملف فارغ." };
  if (size > MAX_DOCUMENT_BYTES) return { ok: false, error: "حجم الملف كبير. الحد الأقصى 50 ميجابايت." };
  const mime = typeof input.mimeType === "string" ? input.mimeType.trim().toLowerCase() : "";
  const mimeType = mime.length <= 200 && MIME.test(mime) ? mime : "application/octet-stream";
  return { ok: true, value: { fileName, mimeType, size } };
}

type DbError = { code?: string; message?: string } | null | undefined;

/** Database errors on documents in plain Arabic; refused writes use permissionMessage. */
export function documentErrorMessage(error: DbError): string | undefined {
  if (!error) return undefined;
  if (error.code === "23505") return "هذا الملف مسجَّل مسبقًا. ارفعه مرة أخرى.";
  if (error.code === "23514") return "بيانات المستند غير صالحة (المسار أو الحجم أو العنوان).";
  if (error.code === "23503") return "المشروع أو الإصدار السابق لم يعد موجودًا.";
  return permissionMessage(error);
}

/** Storage upload errors in plain Arabic. */
export function storageErrorMessage(error: { message?: string; statusCode?: string | number; status?: number } | null | undefined): string | undefined {
  if (!error) return undefined;
  const status = String(error.statusCode ?? error.status ?? "");
  const message = error.message ?? "";
  if (status === "403" || /row-level security|unauthorized/i.test(message)) return permissionMessage({ code: "42501" });
  if (status === "413" || /maximum allowed size|too large/i.test(message)) return "حجم الملف كبير. الحد الأقصى 50 ميجابايت.";
  if (status === "409" || /already exists|duplicate/i.test(message)) return "يوجد ملف بالاسم نفسه. حاول مجددًا.";
  return "تعذّر رفع الملف. تحقّق من اتصالك وحاول مجددًا.";
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** 1536 → "1.5 KB" (binary units, at most one decimal). */
export function formatBytes(bytes: number): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  let rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  if (rounded >= 1024 && unit < units.length - 1) {
    rounded = 1;
    unit++;
  }
  return `${rounded} ${units[unit]}`;
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** A timestamp as a calendar date in the organisation's time zone: "10 Nov 2026". */
export function formatDocumentDate(iso: string, timeZone = "Asia/Riyadh"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  let format = dateFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" });
    dateFormats.set(timeZone, format);
  }
  return format.format(date);
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

type Linked = Pick<DocumentRow, "id" | "supersedes_id">;

/** Rows that no other row in the list supersedes (the current version of each document). */
export function latestVersions<T extends Linked>(docs: readonly T[]): T[] {
  const superseded = new Set<string>();
  for (const d of docs) if (d.supersedes_id && d.supersedes_id !== d.id) superseded.add(d.supersedes_id);
  return docs.filter((d) => !superseded.has(d.id));
}

type Versioned = Linked & Pick<DocumentRow, "version" | "created_at">;
type VersionIndex<T> = { byId: Map<string, T>; next: Map<string, T[]> };

function indexVersions<T extends Versioned>(docs: readonly T[]): VersionIndex<T> {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const next = new Map<string, T[]>();
  for (const d of docs) {
    if (d.supersedes_id && d.supersedes_id !== d.id) next.set(d.supersedes_id, [...(next.get(d.supersedes_id) ?? []), d]);
  }
  return { byId, next };
}

/** The first version reachable by following supersedes_id back from `start` (cycle-safe). */
function firstVersion<T extends Versioned>({ byId }: VersionIndex<T>, start: T): T {
  let root = start;
  const seen = new Set<string>([start.id]);
  for (let prev = start.supersedes_id ? byId.get(start.supersedes_id) : undefined; prev && !seen.has(prev.id); ) {
    seen.add(prev.id);
    root = prev;
    prev = prev.supersedes_id ? byId.get(prev.supersedes_id) : undefined;
  }
  return root;
}

/** `root` and everything that (transitively) supersedes it, newest first. */
function chainFrom<T extends Versioned>({ next }: VersionIndex<T>, root: T): T[] {
  const seen = new Set<string>();
  const chain: T[] = [];
  const queue: T[] = [root];
  while (queue.length) {
    const d = queue.shift() as T;
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    chain.push(d);
    queue.push(...(next.get(d.id) ?? []));
  }
  return chain.sort((a, b) => b.version - a.version || b.created_at.localeCompare(a.created_at));
}

/**
 * Every version of the document `id` belongs to, newest first: follows supersedes_id back to the
 * first version, then forward through everything that supersedes it.
 */
export function versionHistory<T extends Versioned>(docs: readonly T[], id: string): T[] {
  const index = indexVersions(docs);
  const start = index.byId.get(id);
  return start ? chainFrom(index, firstVersion(index, start)) : [];
}

// ---------------------------------------------------------------------------
// Filters (URL search params of the library pages)
// ---------------------------------------------------------------------------

export type DocumentFilters = {
  q: string;
  category: DocumentCategory | null;
  projectId: string | null;
  /** Organisation documents only (no project). */
  orgOnly: boolean;
  /** Every version instead of the latest of each document. */
  allVersions: boolean;
};

export const NO_FILTERS: DocumentFilters = { q: "", category: null, projectId: null, orgOnly: false, allVersions: false };

export function parseDocumentFilters(params: Record<string, string | string[] | undefined>): DocumentFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const category = one("category");
  const project = one("project");
  return {
    q: one("q").trim().slice(0, 200),
    category: isDocumentCategory(category) ? category : null,
    projectId: isUuid(project) ? project : null,
    orgOnly: one("scope") === "org",
    allVersions: one("versions") === "all",
  };
}

export const hasActiveFilters = (f: DocumentFilters) =>
  Boolean(f.q || f.category || f.projectId || f.orgOnly || f.allVersions);

/** Lower-case, without Arabic diacritics and with common letter variants unified, for searching. */
export function searchKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

type Filterable = Linked & Pick<DocumentRow, "title" | "file_name" | "category" | "project_id">;

/** Latest versions (unless allVersions), then search on title and file name, category and project filters. */
export function filterDocuments<T extends Filterable>(docs: readonly T[], f: DocumentFilters): T[] {
  const base = f.allVersions ? [...docs] : latestVersions(docs);
  const q = searchKey(f.q);
  return base.filter(
    (d) =>
      (!f.category || d.category === f.category) &&
      (f.orgOnly ? d.project_id === null : !f.projectId || d.project_id === f.projectId) &&
      (!q || searchKey(d.title).includes(q) || searchKey(d.file_name).includes(q)),
  );
}

// ---------------------------------------------------------------------------
// Permissions (mirrors of the RLS rules, used only to decide what to show)
// ---------------------------------------------------------------------------

/** Mirrors private.can_contribute: admins, and members holding any working capability. */
export function canContributeOrgDocuments(access: Pick<Access, "isAdmin" | "projectManager" | "sales" | "operations" | "finance">): boolean {
  return access.isAdmin || access.projectManager || access.sales || access.operations || access.finance;
}

export type DocumentViewer = {
  /** The viewer's own organisation (null for people outside it, e.g. invited partners). */
  organizationId: string | null;
  /** May add organisation documents (canContributeOrgDocuments). */
  canContribute: boolean;
  /** finance_access in their organisation (admins hold it). */
  finance: boolean;
  /** Projects they may edit: owner or editor role, or every project of their organisation for admins. */
  editableProjectIds: ReadonlySet<string>;
};

type Scoped = Pick<DocumentRow, "organization_id" | "project_id" | "is_confidential">;

/** May the viewer mark documents of this organisation confidential (or see confidential ones)? */
export function canMarkConfidential(doc: Pick<DocumentRow, "organization_id">, viewer: DocumentViewer): boolean {
  return viewer.organizationId === doc.organization_id && viewer.finance;
}

/** Same rule as the documents write policies: project editors or organisation contributors, plus finance for confidential documents. */
export function canWriteDocument(doc: Scoped, viewer: DocumentViewer): boolean {
  if (doc.is_confidential && !canMarkConfidential(doc, viewer)) return false;
  if (doc.project_id) return viewer.editableProjectIds.has(doc.project_id);
  return viewer.organizationId === doc.organization_id && viewer.canContribute;
}

// ---------------------------------------------------------------------------
// Rows for the library UI
// ---------------------------------------------------------------------------

export type DocumentVersionItem = {
  id: string;
  version: number;
  title: string;
  fileName: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  isConfidential: boolean;
};

export type DocumentListItem = DocumentVersionItem & {
  organizationId: string;
  projectId: string | null;
  /** "CODE · name" for project documents. */
  projectLabel: string | null;
  description: string;
  category: DocumentCategory;
  isLatest: boolean;
  canWrite: boolean;
  canMarkConfidential: boolean;
  /** Every version of this document, newest first (includes this row). */
  history: DocumentVersionItem[];
};

/** Shapes the rows to show; `all` (every visible row) is used for versions and history. */
export function toListItems(
  all: readonly DocumentRow[],
  shown: readonly DocumentRow[],
  ctx: { emails: ReadonlyMap<string, string>; projectLabels: ReadonlyMap<string, string>; viewer: DocumentViewer; timeZone?: string },
): DocumentListItem[] {
  const latest = new Set(latestVersions(all).map((d) => d.id));
  const version = (d: DocumentRow): DocumentVersionItem => ({
    id: d.id,
    version: d.version,
    title: d.title,
    fileName: d.file_name,
    size: formatBytes(Number(d.size_bytes)),
    uploadedBy: ctx.emails.get(d.created_by) ?? "—",
    uploadedAt: formatDocumentDate(d.created_at, ctx.timeZone),
    isConfidential: d.is_confidential,
  });
  // Indexed once; each chain is built once and shared by the rows that belong to it.
  const index = indexVersions(all);
  const chains = new Map<string, DocumentVersionItem[]>();
  const historyOf = (d: DocumentRow) => {
    const root = firstVersion(index, d);
    let chain = chains.get(root.id);
    if (!chain) {
      chain = chainFrom(index, root).map(version);
      chains.set(root.id, chain);
    }
    return chain;
  };
  return shown.map((d) => ({
    ...version(d),
    organizationId: d.organization_id,
    projectId: d.project_id,
    projectLabel: d.project_id ? (ctx.projectLabels.get(d.project_id) ?? null) : null,
    description: d.description,
    category: d.category,
    isLatest: latest.has(d.id),
    canWrite: canWriteDocument(d, ctx.viewer),
    canMarkConfidential: canMarkConfidential(d, ctx.viewer),
    history: historyOf(d),
  }));
}
