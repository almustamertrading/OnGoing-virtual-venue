"use client";

import { useState } from "react";
import { FileText, Sparkles, X } from "lucide-react";
import { ProjectForm, type ProjectDefaults, type ScopeDraft } from "@/components/project-form";
import { createClient } from "@/lib/supabase/client";
import type { ClientRow } from "@/lib/types";
import { createProject, extractRfp, type RfpState } from "./actions";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export function RfpImport({ organizationId, clients }: { organizationId: string; clients: ClientRow[] }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<RfpState>({});
  const [pending, setPending] = useState(false);

  function close() {
    setOpen(false);
    setState({});
    setPending(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return setState({ error: "أرفق ملف RFP بصيغة PDF." });
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return setState({ error: "الملف يجب أن يكون PDF." });
    }
    if (file.size > MAX_PDF_BYTES) {
      return setState({ error: "حجم الملف كبير. الحد الأقصى 25 ميجابايت." });
    }

    setPending(true);
    setState({});
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setState({ error: "انتهت الجلسة. سجّل الدخول من جديد." });
        return;
      }
      const path = `${uid}/${crypto.randomUUID()}.pdf`;
      const { error: upError } = await supabase.storage
        .from("rfp-uploads")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upError) {
        setState({ error: "تعذّر رفع الملف. تحقّق من اتصالك وحاول مجددًا." });
        return;
      }
      const fd = new FormData();
      fd.set("path", path);
      const result = await extractRfp({}, fd);
      setState(result);
    } catch {
      setState({ error: "حدث خطأ غير متوقع. حاول مجددًا." });
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
        <Sparkles size={16} /> ابدأ من RFP
      </button>
    );
  }

  const data = state.data;
  const defaults: ProjectDefaults | undefined = data && {
    name: data.name,
    clientName: data.client_name || undefined,
    project_type: data.project_type,
    status: data.status,
    location: data.location,
    budget: data.budget,
    start_date: data.start_date,
    end_date: data.end_date,
    description: [data.summary, data.reference && `مرجع: ${data.reference}`, data.deadline && `آخر موعد للتقديم: ${data.deadline}`]
      .filter(Boolean)
      .join("\n"),
  };
  const items: ScopeDraft[] | undefined = data && [
    ...data.scope.map((t) => ({ kind: "scope" as const, title: t })),
    ...data.deliverables.map((t) => ({ kind: "deliverable" as const, title: t })),
  ];

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
      <div className="card w-full max-w-lg bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">
            {data ? "راجع البيانات المستخرجة" : "ابدأ مشروعًا من ملف RFP"}
          </h2>
          <button type="button" onClick={close} aria-label="إغلاق" className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {!data ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-slate-400">
              ارفع ملف الـRFP بصيغة PDF، ونقرأه لك ونعبّئ بيانات المشروع تلقائيًا: الجهة، النوع، الموقع، التواريخ، نطاق العمل والمخرجات.
            </p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center hover:border-emerald-600">
              <FileText size={28} className="text-emerald-400" />
              <span className="text-sm text-slate-300">اختر ملف PDF (حتى 25 ميجابايت)</span>
              <input type="file" name="file" accept="application/pdf,.pdf" required className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100" />
            </label>
            {state.error && <p className="text-sm text-red-400">{state.error}</p>}
            <button className="btn-primary w-full" disabled={pending}>
              {pending ? "جاري قراءة الملف…" : "استخراج البيانات"}
            </button>
            {pending && <p className="text-center text-xs text-slate-500">قد يستغرق هذا دقيقة للملفات الكبيرة.</p>}
          </form>
        ) : (
          <>
            <p className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-2.5 text-sm text-emerald-200">
              تم استخراج البيانات من الملف. راجعها وعدّل ما يلزم قبل الحفظ.
            </p>
            <div dir="ltr">
              <ProjectForm
                organizationId={organizationId}
                clients={clients}
                action={createProject}
                defaults={defaults}
                items={items}
                submitLabel="إنشاء المشروع"
                onDone={close}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
