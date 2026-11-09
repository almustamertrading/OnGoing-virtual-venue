import { describe, expect, it } from "vitest";
import { accessFor } from "./permissions";
import type { DocumentRow } from "./types";
import {
  MAX_DOCUMENT_BYTES,
  MAX_OBJECT_NAME_LENGTH,
  NO_FILTERS,
  buildDocumentPath,
  canContributeOrgDocuments,
  canMarkConfidential,
  canWriteDocument,
  documentErrorMessage,
  documentFolder,
  filterDocuments,
  formatBytes,
  formatDocumentDate,
  hasActiveFilters,
  isSafeObjectName,
  isUuid,
  latestVersions,
  newUuid,
  parseDocumentFilters,
  parseDocumentPath,
  safeFileName,
  searchKey,
  storageErrorMessage,
  toListItems,
  validateDocumentFields,
  validateDocumentPath,
  validateUploadMeta,
  versionHistory,
  withDownloadName,
  type DocumentViewer,
} from "./documents";

const ORG = "a1000000-0000-4000-8000-00000000000a";
const OTHER_ORG = "b1000000-0000-4000-8000-00000000000b";
const PROJECT = "a1000000-0000-4000-8000-0000000000e1";
const OTHER_PROJECT = "a1000000-0000-4000-8000-0000000000e2";
const DOC = "d1000000-0000-4000-8000-000000000001";

function doc(id: string, over: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id,
    organization_id: ORG,
    project_id: PROJECT,
    title: `Doc ${id}`,
    description: "",
    category: "other",
    storage_path: `${ORG}/${PROJECT}/${id}/file.pdf`,
    file_name: "file.pdf",
    mime_type: "application/pdf",
    size_bytes: 10,
    version: 1,
    supersedes_id: null,
    is_confidential: false,
    created_by: "u1",
    created_at: "2026-11-09T08:00:00Z",
    updated_at: "2026-11-09T08:00:00Z",
    ...over,
  };
}

describe("safeFileName", () => {
  it("keeps plain ASCII names and the extension", () => {
    expect(safeFileName("contract.pdf")).toBe("contract.pdf");
    expect(safeFileName("Venue_Plan-v2.DWG")).toBe("Venue_Plan-v2.DWG");
    expect(safeFileName("archive.tar.gz")).toBe("archive.tar.gz");
  });

  it("replaces anything outside [A-Za-z0-9._-] with a single dash", () => {
    expect(safeFileName("my file (final) #2.pdf")).toBe("my-file-final-2.pdf");
    expect(safeFileName("a  &  b.png")).toBe("a-b.png");
    expect(safeFileName("100%_done!.txt")).toBe("100-done.txt");
  });

  it("turns Arabic-only names into a generic name but keeps the extension", () => {
    expect(safeFileName("عقد الإيجار.pdf")).toBe("file.pdf");
    expect(safeFileName("مخطط القاعة.dwg")).toBe("file.dwg");
    expect(safeFileName("عرض Proposal 2026.docx")).toBe("Proposal-2026.docx");
  });

  it("drops accents instead of the letters", () => {
    expect(safeFileName("résumé café.pdf")).toBe("resume-cafe.pdf");
  });

  it("neutralises path traversal and hidden-file tricks", () => {
    expect(safeFileName("../x")).toBe("x");
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("..\\..\\windows\\evil.exe")).toBe("evil.exe");
    expect(safeFileName("..")).toBe("file");
    expect(safeFileName("...pdf")).toBe("file.pdf");
    expect(safeFileName(".env")).toBe("env");
    expect(safeFileName("x/../../y.pdf")).toBe("y.pdf");
    expect(safeFileName("a..b.pdf")).toBe("a.b.pdf");
  });

  it("handles empty and odd input", () => {
    expect(safeFileName("")).toBe("file");
    expect(safeFileName("   ")).toBe("file");
    expect(safeFileName("report.")).toBe("report");
    expect(safeFileName("noextension")).toBe("noextension");
    expect(safeFileName("weird.p d f")).toBe("weird.pdf");
    expect(safeFileName("🎉party.png")).toBe("party.png");
  });

  it("limits the length and keeps the extension", () => {
    const name = safeFileName(`${"a".repeat(300)}.pdf`);
    expect(name.length).toBe(MAX_OBJECT_NAME_LENGTH);
    expect(name.endsWith(".pdf")).toBe(true);
    expect(safeFileName(`x.${"y".repeat(40)}`)).toBe(`x.${"y".repeat(10)}`);
  });

  it("always produces a name that passes isSafeObjectName", () => {
    const samples = [
      "../x", "..", ".", "-", "_._", "عقد.pdf", "a b c", "C:\\temp\\file.txt", "file\u0000name.pdf",
      "%2e%2e%2fetc", "<script>.html", "x".repeat(500), "ملف", " leading space.pdf", "trailing-.pdf",
      "dots...in...name.txt", "UPPER.PDF", "tab\tname.csv", "new\nline.txt", "semi;colon.doc",
    ];
    for (const s of samples) {
      const out = safeFileName(s);
      expect(isSafeObjectName(out), `${JSON.stringify(s)} -> ${out}`).toBe(true);
      expect(out).not.toContain("/");
      expect(out).not.toContain("..");
    }
  });
});

describe("storage paths", () => {
  const project = { organizationId: ORG, projectId: PROJECT };
  const org = { organizationId: ORG, projectId: null };

  it("builds <org>/<project | org>/<uuid>/<safe name>", () => {
    expect(documentFolder(project)).toBe(`${ORG}/${PROJECT}`);
    expect(documentFolder(org)).toBe(`${ORG}/org`);
    expect(buildDocumentPath(project, DOC, "My Contract.pdf")).toBe(`${ORG}/${PROJECT}/${DOC}/My-Contract.pdf`);
    expect(buildDocumentPath(org, DOC, "../../عقد.pdf")).toBe(`${ORG}/org/${DOC}/file.pdf`);
  });

  it("parses valid paths and rejects everything else", () => {
    expect(parseDocumentPath(`${ORG}/${PROJECT}/${DOC}/a.pdf`)).toEqual({
      organizationId: ORG, projectId: PROJECT, documentId: DOC, objectName: "a.pdf",
    });
    expect(parseDocumentPath(`${ORG}/org/${DOC}/a.pdf`)?.projectId).toBeNull();
    for (const bad of [
      `${ORG}/${PROJECT}/${DOC}`,
      `${ORG}/${PROJECT}/${DOC}/a.pdf/extra`,
      `${ORG}/${PROJECT}/not-a-uuid/a.pdf`,
      `not-a-uuid/org/${DOC}/a.pdf`,
      `${ORG}/projects/${DOC}/a.pdf`,
      `${ORG}/${PROJECT}/${DOC}/..`,
      `${ORG}/${PROJECT}/${DOC}/../a.pdf`,
      `${ORG}/${PROJECT}/${DOC}/عقد.pdf`,
      `${ORG.toUpperCase()}/org/${DOC}/a.pdf`,
      `/${ORG}/org/${DOC}/a.pdf`,
      "",
      42,
      null,
    ]) {
      expect(parseDocumentPath(bad), String(bad)).toBeNull();
    }
  });

  it("validates that the path sits in the expected organisation and project folder", () => {
    const path = buildDocumentPath(project, DOC, "a.pdf");
    const ok = validateDocumentPath(path, project);
    expect(ok.ok && ok.value.documentId).toBe(DOC);
    expect(validateDocumentPath(path, { organizationId: OTHER_ORG, projectId: PROJECT }).ok).toBe(false);
    expect(validateDocumentPath(path, { organizationId: ORG, projectId: OTHER_PROJECT }).ok).toBe(false);
    // A project file cannot be registered as an organisation document, and vice versa.
    expect(validateDocumentPath(path, org).ok).toBe(false);
    expect(validateDocumentPath(buildDocumentPath(org, DOC, "a.pdf"), project).ok).toBe(false);
    expect(validateDocumentPath(buildDocumentPath(org, DOC, "a.pdf"), org).ok).toBe(true);
    const bad = validateDocumentPath("../../etc/passwd", org);
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toMatch(/غير صالح/);
  });

  it("recognises canonical UUIDs only", () => {
    expect(isUuid(DOC)).toBe(true);
    expect(isUuid(DOC.toUpperCase())).toBe(false);
    expect(isUuid(`${DOC}x`)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  it("generates v4 UUIDs, with or without crypto.randomUUID", () => {
    expect(isUuid(newUuid())).toBe(true);
    const fallback = newUuid({ getRandomValues: <T extends ArrayBufferView>(array: T): T => crypto.getRandomValues(array) });
    expect(fallback).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("adds the original file name to signed URLs, encoded once", () => {
    const url = "http://127.0.0.1:54321/storage/v1/object/sign/documents/x/file.pdf?token=abc";
    expect(withDownloadName(url, "عقد الإيجار.pdf")).toBe(`${url}&download=${encodeURIComponent("عقد الإيجار.pdf")}`);
    expect(withDownloadName("http://h/x", "a b.pdf")).toBe("http://h/x?download=a%20b.pdf");
    expect(withDownloadName(url, "  ")).toBe(`${url}&download=download`);
  });
});

describe("formatBytes", () => {
  it("formats human-readable sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(150 * 1024)).toBe("150 KB");
    expect(formatBytes(1024 * 1024 - 1)).toBe("1 MB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(2.25 * 1024 * 1024)).toBe("2.3 MB");
    expect(formatBytes(MAX_DOCUMENT_BYTES)).toBe("50 MB");
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.5 GB");
  });

  it("returns a dash for invalid sizes", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatDocumentDate", () => {
  it("shows the calendar date in the organisation's time zone", () => {
    expect(formatDocumentDate("2026-11-09T08:00:00Z")).toBe("9 Nov 2026");
    // 22:30 UTC is already the next day in Riyadh (UTC+3).
    expect(formatDocumentDate("2026-11-09T22:30:00Z")).toBe("10 Nov 2026");
    expect(formatDocumentDate("2026-11-09T22:30:00Z", "UTC")).toBe("9 Nov 2026");
    expect(formatDocumentDate("not a date")).toBe("");
  });
});

describe("versions", () => {
  const v1 = doc("v1", { version: 1, created_at: "2026-11-01T00:00:00Z" });
  const v2 = doc("v2", { version: 2, supersedes_id: "v1", created_at: "2026-11-02T00:00:00Z" });
  const v3 = doc("v3", { version: 3, supersedes_id: "v2", created_at: "2026-11-03T00:00:00Z" });
  const other = doc("other");

  it("picks the latest version of each document and keeps the order", () => {
    expect(latestVersions([v3, other, v2, v1]).map((d) => d.id)).toEqual(["v3", "other"]);
    expect(latestVersions([v1, v2]).map((d) => d.id)).toEqual(["v2"]);
    expect(latestVersions([])).toEqual([]);
  });

  it("treats a version as latest when its successor is not visible", () => {
    // v2 hidden (e.g. confidential): v1 and v3 are both "latest" in what this viewer sees.
    expect(latestVersions([v1, v3]).map((d) => d.id)).toEqual(["v1", "v3"]);
  });

  it("ignores a row that claims to supersede itself", () => {
    const loop = doc("loop", { supersedes_id: "loop" });
    expect(latestVersions([loop]).map((d) => d.id)).toEqual(["loop"]);
  });

  it("follows supersedes_id both ways, newest first", () => {
    const all = [other, v1, v3, v2];
    expect(versionHistory(all, "v2").map((d) => d.id)).toEqual(["v3", "v2", "v1"]);
    expect(versionHistory(all, "v1").map((d) => d.id)).toEqual(["v3", "v2", "v1"]);
    expect(versionHistory(all, "v3").map((d) => d.id)).toEqual(["v3", "v2", "v1"]);
    expect(versionHistory(all, "other").map((d) => d.id)).toEqual(["other"]);
    expect(versionHistory(all, "missing")).toEqual([]);
  });

  it("includes parallel versions and survives cycles", () => {
    const v2b = doc("v2b", { version: 2, supersedes_id: "v1", created_at: "2026-11-05T00:00:00Z" });
    expect(versionHistory([v1, v2, v2b], "v2").map((d) => d.id)).toEqual(["v2b", "v2", "v1"]);
    const a = doc("a", { supersedes_id: "b", version: 2 });
    const b = doc("b", { supersedes_id: "a", version: 1 });
    expect(versionHistory([a, b], "a").map((d) => d.id).sort()).toEqual(["a", "b"]);
  });
});

describe("filters", () => {
  it("parses search params and ignores invalid values", () => {
    expect(parseDocumentFilters({})).toEqual(NO_FILTERS);
    expect(
      parseDocumentFilters({ q: "  عقد ", category: "contract", project: PROJECT, scope: "org", versions: "all" }),
    ).toEqual({ q: "عقد", category: "contract", projectId: PROJECT, orgOnly: true, allVersions: true });
    expect(parseDocumentFilters({ category: "secret", project: "'; drop table", versions: "yes" })).toEqual(NO_FILTERS);
    expect(parseDocumentFilters({ q: ["a", "b"] }).q).toBe("a");
    expect(parseDocumentFilters({ q: "x".repeat(500) }).q.length).toBe(200);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, allVersions: true })).toBe(true);
  });

  const contract = doc("c1", { title: "Venue Contract", file_name: "venue.pdf", category: "contract" });
  const contract2 = doc("c2", { title: "Venue Contract", file_name: "venue-v2.pdf", category: "contract", version: 2, supersedes_id: "c1" });
  const permit = doc("p1", { title: "تصريح الدفاع المدني", file_name: "permit.pdf", category: "permit", project_id: OTHER_PROJECT });
  const policy = doc("o1", { title: "سياسة السفر", file_name: "travel-policy.docx", project_id: null });
  const all = [contract2, contract, permit, policy];
  const ids = (f: Partial<typeof NO_FILTERS>) => filterDocuments(all, { ...NO_FILTERS, ...f }).map((d) => d.id);

  it("shows latest versions by default, every version on request", () => {
    expect(ids({})).toEqual(["c2", "p1", "o1"]);
    expect(ids({ allVersions: true })).toEqual(["c2", "c1", "p1", "o1"]);
  });

  it("searches title and file name, ignoring case and Arabic letter variants", () => {
    expect(ids({ q: "venue" })).toEqual(["c2"]);
    expect(ids({ q: "VENUE-V2" })).toEqual(["c2"]);
    expect(ids({ q: "travel" })).toEqual(["o1"]);
    expect(ids({ q: "تصريح" })).toEqual(["p1"]);
    expect(ids({ q: "سياسه" })).toEqual(["o1"]);
    expect(ids({ q: "nothing" })).toEqual([]);
  });

  it("filters by category, project and organisation documents only", () => {
    expect(ids({ category: "permit" })).toEqual(["p1"]);
    expect(ids({ projectId: OTHER_PROJECT })).toEqual(["p1"]);
    expect(ids({ orgOnly: true })).toEqual(["o1"]);
    // "Organisation documents only" wins over a project filter.
    expect(ids({ orgOnly: true, projectId: PROJECT })).toEqual(["o1"]);
  });

  it("normalises search keys", () => {
    expect(searchKey("  أَحْمَد  ")).toBe("احمد");
    expect(searchKey("مستشفى")).toBe("مستشفي");
    expect(searchKey("ABC")).toBe("abc");
  });
});

describe("permissions mirror", () => {
  const viewer = (over: Partial<DocumentViewer> = {}): DocumentViewer => ({
    organizationId: ORG, canContribute: false, finance: false, editableProjectIds: new Set(), ...over,
  });

  it("lets admins and members with a working capability add organisation documents", () => {
    expect(canContributeOrgDocuments(accessFor("admin", []))).toBe(true);
    expect(canContributeOrgDocuments(accessFor("staff", ["finance_access"]))).toBe(true);
    expect(canContributeOrgDocuments(accessFor("staff", ["sales_access"]))).toBe(true);
    expect(canContributeOrgDocuments(accessFor("staff", ["operations_access"]))).toBe(true);
    expect(canContributeOrgDocuments(accessFor("manager", ["project_manager"]))).toBe(true);
    expect(canContributeOrgDocuments(accessFor("staff", []))).toBe(false);
    expect(canContributeOrgDocuments(accessFor(null, null))).toBe(false);
  });

  it("lets project editors write project documents", () => {
    const d = doc("x");
    expect(canWriteDocument(d, viewer({ editableProjectIds: new Set([PROJECT]) }))).toBe(true);
    expect(canWriteDocument(d, viewer())).toBe(false);
    expect(canWriteDocument(d, viewer({ canContribute: true }))).toBe(false);
    // Invited partners (outside the organisation) who edit the project.
    expect(canWriteDocument(d, viewer({ organizationId: null, editableProjectIds: new Set([PROJECT]) }))).toBe(true);
  });

  it("lets contributors of the same organisation write organisation documents", () => {
    const d = doc("x", { project_id: null });
    expect(canWriteDocument(d, viewer({ canContribute: true }))).toBe(true);
    expect(canWriteDocument(d, viewer())).toBe(false);
    expect(canWriteDocument(d, viewer({ organizationId: OTHER_ORG, canContribute: true }))).toBe(false);
  });

  it("requires finance access in the document's organisation for confidential documents", () => {
    const project = doc("x", { is_confidential: true });
    const org = doc("y", { is_confidential: true, project_id: null });
    const editor = viewer({ editableProjectIds: new Set([PROJECT]), canContribute: true });
    expect(canWriteDocument(project, editor)).toBe(false);
    expect(canWriteDocument(org, editor)).toBe(false);
    expect(canWriteDocument(project, { ...editor, finance: true })).toBe(true);
    expect(canWriteDocument(org, { ...editor, finance: true })).toBe(true);
    // A partner editor never has finance access to the organisation.
    expect(canWriteDocument(project, { ...editor, organizationId: null, finance: true })).toBe(false);
    expect(canMarkConfidential(project, viewer({ finance: true }))).toBe(true);
    expect(canMarkConfidential(project, viewer())).toBe(false);
    expect(canMarkConfidential({ organization_id: OTHER_ORG }, viewer({ finance: true }))).toBe(false);
  });
});

describe("input validation", () => {
  it("validates title, category and description", () => {
    expect(validateDocumentFields({ title: "  Contract ", category: "contract", description: " d " })).toEqual({
      ok: true, value: { title: "Contract", category: "contract", description: "d" },
    });
    expect(validateDocumentFields({ title: "", category: "" }, "file.pdf")).toEqual({
      ok: true, value: { title: "file.pdf", category: "other", description: "" },
    });
    expect(validateDocumentFields({ title: " " }).ok).toBe(false);
    expect(validateDocumentFields({ title: "x".repeat(301) }).ok).toBe(false);
    expect(validateDocumentFields({ title: "x".repeat(300) }).ok).toBe(true);
    expect(validateDocumentFields({ title: "x", category: "secret" }).ok).toBe(false);
    expect(validateDocumentFields({ title: "x", description: "y".repeat(4001) }).ok).toBe(false);
    expect(validateDocumentFields({ title: 42 as unknown as string }, "fallback.pdf")).toMatchObject({ ok: true, value: { title: "fallback.pdf" } });
  });

  it("validates the uploaded file's name, size and type", () => {
    expect(validateUploadMeta({ fileName: "a.pdf", mimeType: "application/PDF", size: 10 })).toEqual({
      ok: true, value: { fileName: "a.pdf", mimeType: "application/pdf", size: 10 },
    });
    expect(validateUploadMeta({ fileName: "a.bin", mimeType: "", size: 1 })).toMatchObject({ ok: true, value: { mimeType: "application/octet-stream" } });
    expect(validateUploadMeta({ fileName: "a.html", mimeType: "text/html\r\nX-Evil: 1", size: 1 })).toMatchObject({ value: { mimeType: "application/octet-stream" } });
    expect(validateUploadMeta({ fileName: "a.pdf", size: MAX_DOCUMENT_BYTES })).toMatchObject({ ok: true });
    expect(validateUploadMeta({ fileName: "a.pdf", size: MAX_DOCUMENT_BYTES + 1 })).toMatchObject({ ok: false, error: expect.stringMatching(/50/) });
    expect(validateUploadMeta({ fileName: "a.pdf", size: 0 })).toMatchObject({ ok: false });
    expect(validateUploadMeta({ fileName: "a.pdf", size: -5 })).toMatchObject({ ok: false });
    expect(validateUploadMeta({ fileName: "a.pdf", size: 1.5 })).toMatchObject({ ok: false });
    expect(validateUploadMeta({ fileName: "a.pdf", size: "10" })).toMatchObject({ ok: false });
    expect(validateUploadMeta({ fileName: "  ", size: 10 })).toMatchObject({ ok: false });
    const long = validateUploadMeta({ fileName: `${"ع".repeat(400)}.pdf`, size: 10 });
    expect(long.ok && long.value.fileName.length).toBe(300);
  });

  it("explains database and storage errors", () => {
    expect(documentErrorMessage({ code: "42501", message: "new row violates row-level security policy" })).toMatch(/صلاحية/);
    expect(documentErrorMessage({ code: "23514", message: "check" })).toMatch(/غير صالحة/);
    expect(documentErrorMessage({ code: "23505", message: "dup" })).toMatch(/مسبقًا/);
    expect(documentErrorMessage({ code: "XX000", message: "boom" })).toBe("boom");
    expect(documentErrorMessage(null)).toBeUndefined();
    expect(storageErrorMessage({ statusCode: "403", message: "new row violates row-level security policy" })).toMatch(/صلاحية/);
    expect(storageErrorMessage({ statusCode: "413", message: "The object exceeded the maximum allowed size" })).toMatch(/50/);
    expect(storageErrorMessage({ message: "fetch failed" })).toMatch(/تعذّر رفع الملف/);
  });
});

describe("toListItems", () => {
  it("shapes rows with versions, uploader, project and permissions", () => {
    const v1 = doc("v1", { version: 1, size_bytes: 2048, created_by: "u1" });
    const v2 = doc("v2", { version: 2, supersedes_id: "v1", created_by: "u2", created_at: "2026-11-09T22:30:00Z" });
    const items = toListItems([v2, v1], latestVersions([v2, v1]), {
      emails: new Map([["u2", "sales@example.test"]]),
      projectLabels: new Map([[PROJECT, "PRJ-1 · Gala"]]),
      viewer: { organizationId: ORG, canContribute: false, finance: false, editableProjectIds: new Set([PROJECT]) },
    });
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item).toMatchObject({
      id: "v2", version: 2, isLatest: true, uploadedBy: "sales@example.test", uploadedAt: "10 Nov 2026",
      projectLabel: "PRJ-1 · Gala", canWrite: true, canMarkConfidential: false,
    });
    expect(item.history.map((h) => [h.version, h.uploadedBy, h.size])).toEqual([[2, "sales@example.test", "10 B"], [1, "—", "2 KB"]]);
    // The row itself never carries the storage path to the browser.
    expect(JSON.stringify(item)).not.toContain(v2.storage_path);
  });

  it("gives every row of a document the same history when all versions are shown", () => {
    const v1 = doc("v1", { version: 1 });
    const v2 = doc("v2", { version: 2, supersedes_id: "v1" });
    const other = doc("other", { project_id: null, is_confidential: true });
    const all = [v2, other, v1];
    const items = toListItems(all, filterDocuments(all, { ...NO_FILTERS, allVersions: true }), {
      emails: new Map(),
      projectLabels: new Map(),
      viewer: { organizationId: ORG, canContribute: true, finance: false, editableProjectIds: new Set() },
    });
    expect(items.map((i) => [i.id, i.isLatest, i.history.map((h) => h.id)])).toEqual([
      ["v2", true, ["v2", "v1"]],
      ["other", true, ["other"]],
      ["v1", false, ["v2", "v1"]],
    ]);
    // Contributors without finance access cannot change the confidential organisation document.
    expect(items.find((i) => i.id === "other")).toMatchObject({ canWrite: false, canMarkConfidential: false, projectLabel: null });
  });
});
