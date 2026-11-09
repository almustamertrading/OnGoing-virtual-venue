import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Download } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { lineTotal, proposalTotals } from "@/lib/money";
import { PROPOSAL_STATUS, PROPOSAL_TYPE } from "@/lib/proposal-meta";
import { getMyOrganization } from "@/lib/project";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { ProposalSnapshot, ProposalStatus } from "@/lib/types";

/** A frozen proposal version, read-only. Snapshots hold client-facing content only. */
export default async function ProposalVersionPage({ params }: PageProps<"/proposals/[id]/versions/[version]">) {
  const { id, version } = await params;
  if (!/^\d{1,6}$/.test(version)) notFound();
  if (!(await getUserId())) redirect(`/login?next=/proposals/${id}/versions/${version}`);
  const org = await getMyOrganization();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? "";

  const { data: row } = await supabase
    .from("proposal_versions")
    .select("version, status, note, snapshot, created_by, created_at")
    .eq("proposal_id", id)
    .eq("version", Number(version))
    .maybeSingle();
  if (!row) notFound();
  const snap = row.snapshot as ProposalSnapshot;
  const p = snap.proposal;
  if (!p) notFound();

  const [{ data: client }, { data: author }] = await Promise.all([
    p.client_id ? supabase.from("clients").select("name").eq("id", p.client_id).maybeSingle() : Promise.resolve({ data: null }),
    row.created_by
      ? supabase.from("profiles").select("email, display_name").eq("id", row.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const currency = org?.currency ?? "SAR";
  const items = (snap.items ?? []).map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price) }));
  const { subtotal, vat, grand } = proposalTotals(items, Number(p.vat_rate));
  const status = PROPOSAL_STATUS[row.status as ProposalStatus];
  const authorName = (author as { email: string; display_name: string | null } | null);

  return (
    <>
      <AppHeader email={email}>
        <Link href="/proposals" className="hover:text-white">Proposals</Link>
        <ChevronRight size={14} />
        <Link href={`/proposals/${id}`} className="font-mono hover:text-white">{p.reference}</Link>
        <ChevronRight size={14} />
        <span className="text-slate-200">v{row.version}</span>
      </AppHeader>
      <main dir="rtl" lang="ar" className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6">
        <section className="card p-5">
          <p className="text-xs text-slate-500">
            <bdi className="font-mono">{p.reference}</bdi> · {PROPOSAL_TYPE[p.proposal_type]?.label ?? p.proposal_type}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{p.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-200">النسخة {row.version}</span>
            <span className={`rounded px-1.5 py-0.5 ${status.tone}`}>{status.label}</span>
            <span>
              {authorName ? (authorName.display_name || authorName.email) : "النظام"} · <bdi>{formatDateTime(row.created_at)}</bdi>
            </span>
            {client && <span>· العميل: {(client as { name: string }).name}</span>}
          </div>
          {row.note && <p className="mt-2 text-sm text-slate-300">{row.note}</p>}
          <p className="mt-3 text-xs text-slate-500">نسخة مجمّدة للقراءة فقط: لا تتغير بتعديل العرض لاحقًا، ولا تتضمن التكاليف الداخلية.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/proposals/${id}/print?version=${row.version}`} target="_blank" rel="noreferrer" className="btn-ghost">
              <Download size={15} /> PDF لهذه النسخة
            </a>
            <Link href={`/proposals/${id}`} className="btn-ghost">العودة إلى العرض</Link>
          </div>
        </section>

        {p.summary && (
          <section className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-emerald-300">الملخص التنفيذي</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-200">{p.summary}</p>
          </section>
        )}

        {(snap.sections ?? []).map((s, idx) => (
          <section key={idx} className="card p-4">
            <h2 className="mb-2 font-semibold text-white">{s.heading}</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-200">{s.body || <span className="text-slate-500">—</span>}</p>
          </section>
        ))}

        {items.length > 0 && (
          <section className="card p-5" aria-labelledby="version-boq">
            <h2 id="version-boq" className="mb-3 font-semibold text-white">جدول الكميات والتسعير</h2>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[560px] text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="px-2 py-2 font-medium">البند</th>
                    <th className="px-2 py-2 font-medium">الكمية</th>
                    <th className="px-2 py-2 font-medium">الوحدة</th>
                    <th className="px-2 py-2 font-medium">سعر البيع</th>
                    <th className="px-2 py-2 font-medium">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {items.map((i, idx) => (
                    <tr key={idx} className={i.is_optional ? "text-slate-500" : "text-slate-200"}>
                      <td className="px-2 py-2">{i.description}{i.is_optional && <span className="ms-1 text-[10px]">(اختياري)</span>}</td>
                      <td className="px-2 py-2">{i.quantity}</td>
                      <td className="px-2 py-2">{i.unit || "—"}</td>
                      <td className="px-2 py-2">{formatMoney(i.unit_price, currency)}</td>
                      <td className="px-2 py-2">{formatMoney(lineTotal(i.quantity, i.unit_price), currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 grid gap-2 border-t border-slate-800 pt-4 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-slate-500">الإجمالي قبل الضريبة</dt><dd className="font-semibold text-white">{formatMoney(subtotal, currency)}</dd></div>
              <div><dt className="text-xs text-slate-500">ض.ق.م ({Number(p.vat_rate)}%)</dt><dd className="font-semibold text-white">{formatMoney(vat, currency)}</dd></div>
              <div><dt className="text-xs text-slate-500">الإجمالي شامل الضريبة</dt><dd className="font-semibold text-emerald-300">{formatMoney(grand, currency)}</dd></div>
            </dl>
          </section>
        )}
        {p.valid_until && <p className="text-xs text-slate-500">صالح حتى <bdi>{formatDate(p.valid_until)}</bdi></p>}
      </main>
    </>
  );
}
