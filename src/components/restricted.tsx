import { Lock } from "lucide-react";

/** Shown instead of data the viewer has no permission for. The database refuses the data too. */
export function Restricted({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div dir="rtl" role="status" className="card flex items-start gap-3 p-5 text-sm" data-testid="restricted">
      <Lock size={18} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-slate-400">
          {children ?? "هذه البيانات مقيدة بصلاحية المالية. اطلب الصلاحية من مدير المنظمة إن كان عملك يتطلبها."}
        </p>
      </div>
    </div>
  );
}
