"use server";

import { refresh } from "next/cache";
import { getMyOrganization } from "@/lib/project";
import { accessFor, permissionMessage } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  DOCUMENTS_BUCKET,
  SIGNED_URL_SECONDS,
  canContributeOrgDocuments,
  canWriteDocument,
  documentErrorMessage,
  isUuid,
  validateDocumentFields,
  validateDocumentPath,
  validateUploadMeta,
  withDownloadName,
  type DocumentViewer,
} from "@/lib/documents";
import type { DocumentRow, MemberRole, OrgRole } from "@/lib/types";

// Every query runs as the signed-in user: RLS on `documents` and the policies on the private
// `documents` bucket decide what they may read and write. These actions validate input and
// turn refusals into messages; they never widen access.

export type DocumentActionState = { ok?: boolean; error?: string };

const SESSION_EXPIRED = "انتهت الجلسة. سجّل الدخول من جديد.";
const NOT_FOUND = "المستند غير موجود، أو ليست لديك صلاحية لرؤيته.";
const INVALID = "طلب غير صالح.";
const REFUSED = () => permissionMessage({ code: "42501" });

export type CreateDocumentInput = {
  organizationId: string;
  /** null for an organisation document. */
  projectId: string | null;
  /** Where the browser uploaded the file: <organization_id>/<project_id | org>/<new uuid>/<safe name>. */
  path: string;
  title: string;
  category: string;
  description: string;
  confidential: boolean;
  fileName: string;
  mimeType: string;
  size: number;
  /** The version this upload replaces (a new version), or null for a new document. */
  supersedesId: string | null;
};

/**
 * Registers a file the browser has just uploaded to the `documents` bucket. The uuid folder of
 * the path becomes the document id. On an error the caller removes the uploaded object.
 */
export async function createDocument(input: CreateDocumentInput): Promise<DocumentActionState> {
  if (!input || typeof input !== "object") return { error: INVALID };
  const projectId = input.projectId ?? null;
  if (!isUuid(input.organizationId) || (projectId !== null && !isUuid(projectId))) return { error: INVALID };
  const scope = { organizationId: input.organizationId, projectId };

  const path = validateDocumentPath(input.path, scope);
  if (!path.ok) return { error: path.error };
  const meta = validateUploadMeta(input);
  if (!meta.ok) return { error: meta.error };
  const fields = validateDocumentFields(input, meta.value.fileName);
  if (!fields.ok) return { error: fields.error };
  const supersedesId = input.supersedesId ?? null;
  if (supersedesId !== null && !isUuid(supersedesId)) return { error: INVALID };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: SESSION_EXPIRED };

  // The folder must belong to the organisation: the project's own organisation, or the viewer's
  // organisation for organisation documents (the CHECK constraint ties the path to the row).
  if (projectId) {
    const { data: project } = await supabase.from("projects").select("organization_id").eq("id", projectId).maybeSingle();
    if (!project || project.organization_id !== scope.organizationId) return { error: "المشروع غير موجود، أو ليست لديك صلاحية عليه." };
  } else {
    const org = await getMyOrganization();
    if (!org || org.id !== scope.organizationId) return { error: REFUSED() };
  }

  let version = 1;
  if (supersedesId) {
    const { data: previous } = await supabase
      .from("documents")
      .select("organization_id, project_id, version")
      .eq("id", supersedesId)
      .maybeSingle();
    if (!previous) return { error: "الإصدار السابق غير موجود، أو ليست لديك صلاحية لرؤيته." };
    if (previous.organization_id !== scope.organizationId || previous.project_id !== projectId) {
      return { error: "الإصدار الجديد يجب أن يكون في مكان الإصدار السابق نفسه." };
    }
    const { data: newer } = await supabase.from("documents").select("id").eq("supersedes_id", supersedesId).limit(1);
    if (newer?.length) return { error: "يوجد إصدار أحدث من هذا المستند. ارفع الإصدار الجديد من آخر إصدار." };
    version = Number(previous.version) + 1;
  }

  const documentId = path.value.documentId;
  const { error } = await supabase.from("documents").insert({
    id: documentId,
    organization_id: scope.organizationId,
    project_id: projectId,
    title: fields.value.title,
    description: fields.value.description,
    category: fields.value.category,
    storage_path: input.path,
    file_name: meta.value.fileName,
    mime_type: meta.value.mimeType,
    size_bytes: meta.value.size,
    version,
    supersedes_id: supersedesId,
    is_confidential: input.confidential === true,
  });
  if (error) return { error: documentErrorMessage(error) };

  // The row now lets this user read the object: make sure the upload really is there, so no
  // document ever points at a missing file.
  const { error: infoError } = await supabase.storage.from(DOCUMENTS_BUCKET).info(input.path);
  if (infoError && /not found/i.test(infoError.message)) {
    await supabase.from("documents").delete().eq("id", documentId);
    return { error: "لم يُعثر على الملف المرفوع. ارفعه مرة أخرى." };
  }

  refresh();
  return { ok: true };
}

/** A link to download the file, valid for one minute, under its original file name. */
export async function documentDownloadUrl(id: string): Promise<{ url?: string; error?: string }> {
  if (!isUuid(id)) return { error: INVALID };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!doc) return { error: NOT_FOUND };
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, SIGNED_URL_SECONDS);
  if (error || !data) return { error: "تعذّر تجهيز رابط التنزيل. حاول مجددًا." };
  return { url: withDownloadName(data.signedUrl, doc.file_name) };
}

export type UpdateDocumentInput = {
  title: string;
  category: string;
  description: string;
  /** Sent only by people with finance access; omitted means "leave as is". */
  confidential?: boolean;
};

export async function updateDocument(id: string, input: UpdateDocumentInput): Promise<DocumentActionState> {
  if (!isUuid(id) || !input || typeof input !== "object") return { error: INVALID };
  const fields = validateDocumentFields(input);
  if (!fields.ok) return { error: fields.error };
  const patch: Partial<DocumentRow> = { ...fields.value };
  if (typeof input.confidential === "boolean") patch.is_confidential = input.confidential;

  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").update(patch).eq("id", id).select("id");
  if (error) return { error: documentErrorMessage(error) };
  // RLS filters rows the user may not change: nothing updated means refused (or gone).
  if (!data?.length) return { error: REFUSED() };
  refresh();
  return { ok: true };
}

/** The viewer's rights over one document, loaded the way RLS checks them. */
async function viewerFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  doc: Pick<DocumentRow, "organization_id" | "project_id">,
): Promise<DocumentViewer> {
  const [{ data: membership }, { data: projectMember }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role, capabilities")
      .eq("organization_id", doc.organization_id)
      .eq("user_id", userId)
      .maybeSingle(),
    doc.project_id
      ? supabase.from("project_members").select("role").eq("project_id", doc.project_id).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const access = accessFor((membership?.role as OrgRole | undefined) ?? null, membership?.capabilities as string[] | undefined);
  const projectRole = (projectMember?.role as MemberRole | undefined) ?? null;
  const editable = new Set<string>();
  if (doc.project_id && (access.isAdmin || projectRole === "owner" || projectRole === "editor")) editable.add(doc.project_id);
  return {
    organizationId: membership ? doc.organization_id : null,
    canContribute: canContributeOrgDocuments(access),
    finance: access.finance,
    editableProjectIds: editable,
  };
}

/**
 * Deletes one version: its file, then its row.
 *
 * Why the object goes first: Storage needs read access to delete an object, and the bucket only
 * lets people read objects that a document row they can read points to. Once the row is gone the
 * object can no longer be deleted (or even seen) by the user, so deleting the row first would leave
 * the file behind, still reachable through any signed link already handed out. The write rights are
 * checked up front, and the row delete stays the database-enforced final step.
 */
export async function deleteDocument(id: string): Promise<DocumentActionState> {
  if (!isUuid(id)) return { error: INVALID };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { error: SESSION_EXPIRED };

  const { data: doc } = await supabase
    .from("documents")
    .select("organization_id, project_id, is_confidential, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { error: NOT_FOUND };
  if (!canWriteDocument(doc, await viewerFor(supabase, userId, doc))) return { error: REFUSED() };

  const { error: removeError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
  if (removeError) return { error: "تعذّر حذف الملف من التخزين. حاول مجددًا." };

  const { data: deleted, error } = await supabase.from("documents").delete().eq("id", id).select("id");
  if (error) return { error: permissionMessage(error) };
  if (!deleted?.length) return { error: REFUSED() };
  refresh();
  return { ok: true };
}
