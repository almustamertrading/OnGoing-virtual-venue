import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, hasActiveFilters, type DocumentFilters } from "@/lib/documents";

/**
 * Search and filters as a plain GET form: the state lives in the URL (shareable, works without
 * JavaScript) and the server page filters what RLS returned.
 */
export function DocumentFiltersForm({
  basePath,
  filters,
  projects,
}: {
  basePath: string;
  filters: DocumentFilters;
  /** Project options; omit to hide the project and organisation filters (project tab). */
  projects?: { id: string; label: string }[];
}) {
  const active = hasActiveFilters(filters);
  return (
    // Remount when the URL changes so the uncontrolled fields show the current filters.
    <Form key={JSON.stringify(filters)} action={basePath} role="search" aria-label="البحث في المستندات" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="documents-q">بحث</label>
        <div className="relative">
          <Search size={15} aria-hidden className="pointer-events-none absolute inset-y-0 start-3 my-auto text-slate-500" />
          <input id="documents-q" name="q" type="search" defaultValue={filters.q} placeholder="العنوان أو اسم الملف" className="field ps-9" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="documents-category">التصنيف</label>
        <select id="documents-category" name="category" defaultValue={filters.category ?? ""} className="field">
          <option value="">كل التصنيفات</option>
          {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>
      {projects && (
        <div>
          <label className="label" htmlFor="documents-project">المشروع</label>
          <select id="documents-project" name="project" defaultValue={filters.projectId ?? ""} className="field">
            <option value="">كل المشاريع</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-4">
        {projects && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="scope" value="org" defaultChecked={filters.orgOnly} className="size-4 accent-emerald-500" />
            مستندات المنظمة فقط
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" name="versions" value="all" defaultChecked={filters.allVersions} className="size-4 accent-emerald-500" />
          إظهار الإصدارات السابقة
        </label>
        <div className="ms-auto flex gap-2">
          {active && <Link href={basePath} className="btn-ghost">مسح</Link>}
          <button type="submit" className="btn-primary">تطبيق</button>
        </div>
      </div>
    </Form>
  );
}
