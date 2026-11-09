import { notFound, redirect } from "next/navigation";
import { getMyOrganization } from "@/lib/project";
import { createClient, getUserId } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { PROPOSAL_TYPE } from "@/lib/proposal-meta";
import type { ClientRow, ProposalItemRow, ProposalRow, ProposalSectionRow } from "@/lib/types";
import { PrintButton } from "./print-button";

export default async function ProposalPrintPage({ params }: PageProps<"/proposals/[id]/print">) {
  const { id } = await params;
  if (!(await getUserId())) redirect(`/login?next=/proposals/${id}/print`);
  const org = await getMyOrganization();
  const supabase = await createClient();

  const { data: proposal } = await supabase.from("proposals").select("*").eq("id", id).maybeSingle();
  if (!proposal) notFound();
  const p = proposal as ProposalRow;

  const [{ data: sections }, { data: items }, { data: client }] = await Promise.all([
    supabase.from("proposal_sections").select("*").eq("proposal_id", id).order("sort_order"),
    supabase.from("proposal_items").select("*").eq("proposal_id", id).order("sort_order"),
    p.client_id ? supabase.from("clients").select("*").eq("id", p.client_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const cur = org?.currency ?? "SAR";
  const m = (v: number) => formatMoney(v, cur);
  const all = (items as ProposalItemRow[]) ?? [];
  const billable = all.filter((i) => !i.is_optional);
  const optional = all.filter((i) => i.is_optional);
  const subtotal = billable.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const vat = subtotal * (p.vat_rate / 100);
  const grand = subtotal + vat;
  const cl = (client as ClientRow | null) ?? null;
  const company = org?.name ?? "OnGoing";

  return (
    <div dir="rtl" className="min-h-screen bg-white text-slate-900" style={{ fontFamily: "var(--font-ar, sans-serif)" }}>
      <PrintButton />
      <div className="mx-auto max-w-3xl px-10 py-12 print:px-0 print:py-0">
        {/* Cover */}
        <header className="mb-10 flex items-center justify-between border-b-2 border-emerald-600 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-sm font-black text-white">OG</span>
              <span className="text-xl font-extrabold text-slate-900">{company}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">لإدارة وتنظيم الفعاليات</p>
          </div>
          <div className="text-left">
            <p className="font-mono text-sm font-bold text-emerald-700">{p.reference}</p>
            <p className="text-xs text-slate-500">نسخة {p.version}</p>
          </div>
        </header>

        <div className="mb-10">
          <p className="text-sm font-semibold text-emerald-700">{PROPOSAL_TYPE[p.proposal_type].label}</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{p.title}</h1>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-600">
            {cl && <p><span className="text-slate-400">العميل:</span> {cl.name}</p>}
            {p.issue_date && <p><span className="text-slate-400">تاريخ العرض:</span> {formatDate(p.issue_date)}</p>}
            {p.valid_until && <p><span className="text-slate-400">صالح حتى:</span> {formatDate(p.valid_until)}</p>}
            {cl?.contact_name && <p><span className="text-slate-400">جهة التواصل:</span> {cl.contact_name}</p>}
          </div>
        </div>

        {p.summary && (
          <section className="mb-8">
            <h2 className="mb-2 border-r-4 border-emerald-600 pr-3 text-lg font-bold text-slate-900">الملخص التنفيذي</h2>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{p.summary}</p>
          </section>
        )}

        {((sections as ProposalSectionRow[]) ?? []).filter((s) => s.body || s.heading).map((s) => (
          <section key={s.id} className="mb-7 break-inside-avoid">
            <h2 className="mb-2 border-r-4 border-emerald-600 pr-3 text-lg font-bold text-slate-900">{s.heading}</h2>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{s.body}</p>
          </section>
        ))}

        {/* BOQ (client-facing: no internal cost/margin) */}
        {billable.length > 0 && (
          <section className="mb-7 break-inside-avoid">
            <h2 className="mb-3 border-r-4 border-emerald-600 pr-3 text-lg font-bold text-slate-900">جدول الكميات والتسعير</h2>
            <table className="w-full border-collapse text-right text-sm">
              <thead>
                <tr className="bg-emerald-50 text-xs text-slate-600">
                  <th className="border border-slate-200 px-2 py-2 font-semibold">البند</th>
                  <th className="border border-slate-200 px-2 py-2 font-semibold">الكمية</th>
                  <th className="border border-slate-200 px-2 py-2 font-semibold">الوحدة</th>
                  <th className="border border-slate-200 px-2 py-2 font-semibold">سعر الوحدة</th>
                  <th className="border border-slate-200 px-2 py-2 font-semibold">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {billable.map((i) => (
                  <tr key={i.id}>
                    <td className="border border-slate-200 px-2 py-1.5 text-slate-800">{i.description}{i.category && <span className="text-xs text-slate-400"> · {i.category}</span>}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-slate-700">{i.quantity}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-slate-700">{i.unit || "—"}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-slate-700">{m(i.unit_price)}</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-medium text-slate-900">{m(i.quantity * i.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr><td colSpan={4} className="border border-slate-200 px-2 py-1.5 text-left font-semibold">الإجمالي قبل الضريبة</td><td className="border border-slate-200 px-2 py-1.5">{m(subtotal)}</td></tr>
                <tr><td colSpan={4} className="border border-slate-200 px-2 py-1.5 text-left font-semibold">ضريبة القيمة المضافة ({p.vat_rate}%)</td><td className="border border-slate-200 px-2 py-1.5">{m(vat)}</td></tr>
                <tr className="bg-emerald-50"><td colSpan={4} className="border border-slate-200 px-2 py-2 text-left font-bold text-emerald-800">الإجمالي شامل الضريبة</td><td className="border border-slate-200 px-2 py-2 font-bold text-emerald-800">{m(grand)}</td></tr>
              </tfoot>
            </table>
            {optional.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="mb-1 font-semibold text-slate-700">بنود اختيارية (غير محتسبة في الإجمالي):</p>
                <ul className="list-disc space-y-0.5 pr-5 text-slate-600">
                  {optional.map((i) => <li key={i.id}>{i.description} — {m(i.quantity * i.unit_price)}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        <footer className="mt-12 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          <p>{company} · {p.reference} · مستند سري — للعميل المعني فقط</p>
        </footer>
      </div>
    </div>
  );
}
