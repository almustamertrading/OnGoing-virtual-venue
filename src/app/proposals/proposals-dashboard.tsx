"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { FileText, Plus, Search, Sparkles, X } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { formatDate, formatMoney } from "@/lib/format";
import { PROPOSAL_STATUS, PROPOSAL_TYPE } from "@/lib/proposal-meta";
import type { ClientRow, ProposalRow, ProposalStatus, ProposalType } from "@/lib/types";
import { createProposal, type ActionState } from "./actions";

export function ProposalsDashboard({
  email, organizationId, currency, proposals, clients, values,
}: {
  email: string;
  organizationId: string;
  currency: string;
  proposals: ProposalRow[];
  clients: ClientRow[];
  values: Record<string, number>;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProposalStatus | "all">("all");
  const [creating, setCreating] = useState(false);
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name;

  const stats = useMemo(() => {
    const by = (s: ProposalStatus) => proposals.filter((p) => p.status === s).length;
    const totalValue = proposals.reduce((s, p) => s + (values[p.id] ?? 0), 0);
    const decided = proposals.filter((p) => ["accepted", "converted", "rejected"].includes(p.status)).length;
    const won = proposals.filter((p) => ["accepted", "converted"].includes(p.status)).length;
    return {
      total: proposals.length,
      draft: by("draft") + by("ai_generated"),
      review: by("under_review") + by("changes_requested") + by("approved_internally"),
      sent: by("sent_to_client") + by("awaiting_response"),
      won,
      totalValue,
      conversion: decided ? Math.round((won / decided) * 100) : 0,
    };
  }, [proposals, values]);

  const filtered = proposals.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (!q.trim()) return true;
    const hay = `${p.title} ${p.reference} ${clientName(p.client_id) ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const cards = [
    { k: "إجمالي العروض", v: String(stats.total) },
    { k: "مسودات", v: String(stats.draft) },
    { k: "قيد المراجعة", v: String(stats.review) },
    { k: "مُرسلة للعميل", v: String(stats.sent) },
    { k: "القيمة الإجمالية", v: formatMoney(stats.totalValue, currency) },
    { k: "نسبة التحويل", v: `${stats.conversion}%` },
  ];

  return (
    <>
      <AppHeader email={email}>
        <Link href="/projects" className="hover:text-white">Projects</Link>
        <span className="text-slate-600">·</span>
        <span className="text-slate-200">Proposals</span>
      </AppHeader>

      <main dir="rtl" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">العروض</h1>
            <p className="text-sm text-slate-400">أنشئ عروضًا احترافية بالذكاء الاصطناعي وحوّل المقبول منها إلى مشاريع.</p>
          </div>
          {organizationId && (
            <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> عرض جديد</button>
          )}
        </div>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <div key={c.k} className="card p-3">
              <p className="text-xs text-slate-500">{c.k}</p>
              <p className="mt-1 text-sm font-bold text-white">{c.v}</p>
            </div>
          ))}
        </section>

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو المرجع أو العميل" className="field pr-9" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProposalStatus | "all")} className="field w-44">
            <option value="all">كل الحالات</option>
            {Object.entries(PROPOSAL_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">لا توجد عروض مطابقة.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p) => (
              <li key={p.id} className="card p-0">
                <Link href={`/proposals/${p.id}`} className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-white/[0.03]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400"><FileText size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-100">{p.title}</p>
                    <p className="text-xs text-slate-500">
                      <span className="font-mono">{p.reference}</span> · {PROPOSAL_TYPE[p.proposal_type].label}
                      {clientName(p.client_id) ? ` · ${clientName(p.client_id)}` : ""}
                      {p.due_date ? ` · آخر موعد ${formatDate(p.due_date)}` : ""}
                    </p>
                  </div>
                  {values[p.id] ? <span className="text-sm font-semibold text-white">{formatMoney(values[p.id], currency)}</span> : null}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${PROPOSAL_STATUS[p.status].tone}`}>{PROPOSAL_STATUS[p.status].label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {creating && organizationId && (
        <CreateProposalDialog organizationId={organizationId} clients={clients} onClose={() => setCreating(false)} />
      )}
    </>
  );
}

function CreateProposalDialog({ organizationId, clients, onClose }: { organizationId: string; clients: ClientRow[]; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createProposal.bind(null, organizationId), {});
  const [newClient, setNewClient] = useState(clients.length === 0);

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
      <div className="card w-full max-w-lg bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">عرض جديد</h2>
          <button onClick={onClose} aria-label="إغلاق" className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <form action={action} className="space-y-4">
          <div>
            <label className="label" htmlFor="pr-title">عنوان العرض</label>
            <input id="pr-title" name="title" required placeholder="مثال: عرض تشغيل فعالية…" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="pr-type">نوع العرض</label>
            <select id="pr-type" name="proposal_type" className="field" defaultValue="technical_financial">
              {Object.entries(PROPOSAL_TYPE).map(([v, t]) => <option key={v} value={v}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="label mb-0">العميل</label>
              {clients.length > 0 && (
                <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={() => setNewClient((v) => !v)}>
                  {newClient ? "اختر عميلًا موجودًا" : "عميل جديد"}
                </button>
              )}
            </div>
            {newClient ? (
              <input name="new_client" placeholder="اسم العميل" className="field" />
            ) : (
              <select name="client_id" className="field" defaultValue="">
                <option value="">بدون عميل</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="pr-due">آخر موعد للتقديم</label><input id="pr-due" name="due_date" type="date" className="field" /></div>
            <div><label className="label" htmlFor="pr-valid">صلاحية العرض</label><input id="pr-valid" name="valid_until" type="date" className="field" /></div>
          </div>
          <div>
            <label className="label" htmlFor="pr-brief">موجز العميل (اختياري — يستخدمه الذكاء لاحقًا)</label>
            <textarea id="pr-brief" name="brief" rows={3} placeholder="الصق موجز العميل أو متطلباته هنا…" className="field" />
          </div>
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>
            <Sparkles size={15} /> {pending ? "جارٍ الإنشاء…" : "إنشاء العرض"}
          </button>
        </form>
      </div>
    </div>
  );
}
