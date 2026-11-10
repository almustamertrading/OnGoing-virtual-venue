import Link from "next/link";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import { arabicDays, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { SECTION_LABEL, type Fact, type ManagementSummary, type SectionId, type Suggestion } from "@/lib/management";

const KIND = {
  fact: { label: "حقيقة", tone: "bg-emerald-500/10 text-emerald-300" },
  estimate: { label: "تقدير", tone: "bg-amber-500/15 text-amber-300" },
} as const;

/** What the three kinds of statement mean; the same labels are used on every figure below. */
export function Legend() {
  return (
    <ul className="flex flex-wrap gap-2 text-xs" aria-label="دلالة التسميات" data-testid="summary-legend">
      <li className="flex items-center gap-1.5 rounded-md border border-slate-800 px-2 py-1">
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${KIND.fact.tone}`}>حقيقة</span> رقم محسوب الآن من بيانات النظام
      </li>
      <li className="flex items-center gap-1.5 rounded-md border border-slate-800 px-2 py-1">
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${KIND.estimate.tone}`}>تقدير</span> قيمة متوقعة قد لا تتحقق
      </li>
      <li className="flex items-center gap-1.5 rounded-md border border-slate-800 px-2 py-1">
        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[11px] text-violet-300">توصية</span> إجراء مقترح يحتاج قرارك
      </li>
    </ul>
  );
}

function FactRow({ fact }: { fact: Fact }) {
  const kind = KIND[fact.kind];
  return (
    <div className="flex items-baseline gap-2 py-1.5" data-testid={`fact-${fact.id}`} data-value={fact.value}>
      <dt className="min-w-0 flex-1 text-sm text-slate-300">{fact.label}</dt>
      <span className={`rounded px-1.5 py-0.5 text-[10px] ${kind.tone}`}>{kind.label}</span>
      <dd className={`text-base font-semibold tabular-nums ${fact.value > 0 ? "text-white" : "text-slate-500"}`}>
        {fact.href ? <Link href={fact.href} className="hover:underline"><bdi>{fact.display}</bdi></Link> : <bdi>{fact.display}</bdi>}
      </dd>
    </div>
  );
}

/** One section: its facts (per-project facts are listed under the details instead), then details. */
export function SectionCard({ id, facts, children }: { id: SectionId; facts: Fact[]; children?: React.ReactNode }) {
  const shown = facts.filter((f) => f.section === id && !/^tasks\.overdue\./.test(f.id));
  return (
    <section className="card p-5" aria-labelledby={`section-${id}-title`} data-testid={`summary-section-${id}`}>
      <h2 id={`section-${id}-title`} className="mb-2 font-semibold text-white">{SECTION_LABEL[id]}</h2>
      <dl className="divide-y divide-slate-800/70">
        {shown.map((f) => <FactRow key={f.id} fact={f} />)}
      </dl>
      {children}
    </section>
  );
}

function Details({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-slate-800 pt-3" data-testid={testId}>
      <h3 className="mb-1 text-xs font-medium text-slate-400">{title}</h3>
      <ul className="space-y-1 text-sm">{children}</ul>
    </div>
  );
}

const Badge = ({ children, tone = "bg-slate-800 text-slate-300" }: { children: React.ReactNode; tone?: string }) => (
  <span className={`rounded px-1.5 py-0.5 text-[11px] ${tone}`}>{children}</span>
);

export function AttentionDetails({ s }: { s: ManagementSummary }) {
  return (
    <>
      {s.tasks.overdueByProject.length > 0 && (
        <Details title="المهام المتأخرة حسب المشروع" testId="overdue-by-project">
          {s.tasks.overdueByProject.map((p) => (
            <li key={p.projectId} className="flex flex-wrap items-baseline gap-2" data-count={p.count}>
              <Link href={`/projects/${p.projectId}/tasks`} className="min-w-0 flex-1 basis-40 text-slate-200 hover:underline">{p.name} <span className="text-xs text-slate-500">{p.code}</span></Link>
              <span className="text-xs text-slate-400">أقدم موعد فائت <bdi>{formatDate(p.oldestDue)}</bdi></span>
              <span className="font-semibold tabular-nums text-red-300">{p.count}</span>
            </li>
          ))}
        </Details>
      )}
      {s.milestones.overdue.length > 0 && (
        <Details title="مراحل فات موعدها" testId="overdue-milestones">
          {s.milestones.overdue.map((m, i) => (
            <li key={`${m.projectId}-${i}`} className="flex flex-wrap items-baseline gap-2">
              <Link href={`/projects/${m.projectId}/tasks`} className="min-w-0 flex-1 basis-40 text-slate-200 hover:underline">{m.title} <span className="text-xs text-slate-500">· {m.name}</span></Link>
              <span className="text-xs text-red-300"><bdi>{formatDate(m.dueDate)}</bdi></span>
            </li>
          ))}
        </Details>
      )}
    </>
  );
}

export function ApprovalsDetails({ s }: { s: ManagementSummary }) {
  return (
    <>
      {s.approvals.underReview.length > 0 && (
        <Details title="عروض بانتظار الاعتماد الداخلي" testId="proposals-under-review">
          {s.approvals.underReview.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline gap-2">
              <Link href={`/proposals/${p.id}`} className="min-w-0 flex-1 basis-40 text-slate-200 hover:underline">{p.title} <span className="text-xs text-slate-500">{p.reference}</span></Link>
              <span className="text-xs text-slate-400">منذ <bdi>{formatDateTime(p.since)}</bdi></span>
            </li>
          ))}
        </Details>
      )}
      {s.approvals.requirementsDue.length > 0 && (
        <Details title="متطلبات إلزامية مستحقة" testId="requirements-due">
          {s.approvals.requirementsDue.map((r, i) => (
            <li key={`${r.projectId}-${i}`} className="flex flex-wrap items-baseline gap-2">
              <Link href={`/projects/${r.projectId}/requirements`} className="min-w-0 flex-1 basis-40 text-slate-200 hover:underline">{r.title} <span className="text-xs text-slate-500">· {r.name}</span></Link>
              {r.overdue && <Badge tone="bg-red-950 text-red-200">متأخر</Badge>}
              <span className="text-xs text-slate-400"><bdi>{formatDate(r.dueDate)}</bdi></span>
            </li>
          ))}
        </Details>
      )}
    </>
  );
}

export function ProcurementDetails({ s }: { s: ManagementSummary }) {
  if (s.procurement.open.length === 0) return null;
  return (
    <Details title="طلبات التسعير المفتوحة (الأكثر إلحاحًا أولًا)" testId="open-rfqs">
      {s.procurement.open.map((r) => (
        <li key={r.rfqId} className="flex flex-wrap items-baseline gap-2">
          <Link href={`/projects/${r.projectId}/procurement`} className="min-w-0 flex-1 basis-40 text-slate-200 hover:underline">{r.title} <span className="text-xs text-slate-500">· {r.name}</span></Link>
          {r.responseOverdue && <Badge tone="bg-amber-950 text-amber-200">تجاوز موعد الرد</Badge>}
          {r.nearEvent && <Badge tone="bg-red-950 text-red-200">الفعالية خلال ثلاثة أسابيع</Badge>}
          {r.pricedQuotes !== null && <span className="text-xs text-slate-400">عروض مسعّرة: {r.pricedQuotes}</span>}
        </li>
      ))}
    </Details>
  );
}

export function RisksDetails({ s }: { s: ManagementSummary }) {
  if (s.risks.high.length === 0) return null;
  return (
    <Details title="عالية الأثر" testId="high-risks">
      {s.risks.high.map((k) => (
        <li key={k.id} className="flex flex-wrap items-baseline gap-2">
          <Badge>{k.kind === "risk" ? "خطر" : "مشكلة"}</Badge>
          <Link href={`/projects/${k.projectId}/operations`} className="min-w-0 flex-1 basis-40 text-slate-200 hover:underline" dir="auto">{k.title}</Link>
          <span className="text-xs text-slate-500">{k.name}</span>
        </li>
      ))}
    </Details>
  );
}

export function FinanceDetails({ s, currency }: { s: ManagementSummary; currency: string }) {
  const f = s.finance;
  if (!f) return null;
  const money = (n: number) => formatMoney(n, currency);
  return (
    <>
      {f.overdueInvoices.length > 0 && (
        <Details title="فواتير متأخرة السداد" testId="overdue-invoices">
          {f.overdueInvoices.map((i, n) => (
            <li key={`${i.projectId}-${n}`} className="flex flex-wrap items-baseline gap-2">
              <Link href={`/projects/${i.projectId}/finance`} className="min-w-0 flex-1 basis-40 text-slate-200 hover:underline">{i.number || "فاتورة"} <span className="text-xs text-slate-500">· {i.name}</span></Link>
              <span className="text-xs text-red-300">متأخرة {arabicDays(i.daysOverdue)}</span>
              <span className="tabular-nums text-slate-100"><bdi>{money(i.amount)}</bdi></span>
            </li>
          ))}
        </Details>
      )}
      {f.overBudget.length > 0 && (
        <Details title="تجاوز الميزانية" testId="over-budget">
          {f.overBudget.map((p) => (
            <li key={p.projectId} className="flex flex-wrap items-baseline gap-2">
              <Link href={`/projects/${p.projectId}/finance`} className="min-w-0 flex-1 basis-40 text-slate-200 hover:underline">{p.name}</Link>
              <span className="text-xs text-slate-400">الميزانية <bdi>{money(p.budget)}</bdi> · المصروفات <bdi>{money(p.expenses)}</bdi></span>
              <span className="tabular-nums text-red-300">+<bdi>{money(p.excess)}</bdi></span>
            </li>
          ))}
        </Details>
      )}
      {f.negativeMargin.length > 0 && (
        <Details title="مصروفات أعلى من المفوتر حتى الآن" testId="negative-margin">
          {f.negativeMargin.map((p) => (
            <li key={p.projectId} className="flex flex-wrap items-baseline gap-2">
              <Link href={`/projects/${p.projectId}/finance`} className="min-w-0 flex-1 basis-40 text-slate-200 hover:underline">{p.name}</Link>
              <span className="text-xs text-slate-400">المفوتر <bdi>{money(p.invoiced)}</bdi> · المصروفات <bdi>{money(p.expenses)}</bdi></span>
            </li>
          ))}
        </Details>
      )}
      {f.lowMarginProposals.length > 0 && (
        <Details title="هامش متوقع منخفض (تقدير إن قُبل العرض بالأسعار والتكاليف الحالية)" testId="low-margin-proposals">
          {f.lowMarginProposals.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline gap-2">
              <Badge tone={KIND.estimate.tone}>تقدير</Badge>
              <Link href={`/proposals/${p.id}`} className="min-w-0 flex-1 basis-40 text-slate-200 hover:underline">{p.title} <span className="text-xs text-slate-500">{p.reference}</span></Link>
              <span className="tabular-nums text-amber-300">{p.marginPct}%</span>
            </li>
          ))}
        </Details>
      )}
    </>
  );
}

const TONE = {
  critical: { Icon: CircleAlert, icon: "text-red-400", label: "عاجل" },
  warning: { Icon: AlertTriangle, icon: "text-amber-400", label: "مهم" },
  info: { Icon: Info, icon: "text-sky-400", label: "للعلم" },
} as const;

/** Suggestions from fixed rules over the facts (no AI), each with the figures behind it. */
export function SuggestionsCard({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <section className="card p-5" aria-labelledby="suggestions-title" data-testid="rule-suggestions">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 id="suggestions-title" className="font-semibold text-white">إجراءات مقترحة</h2>
        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[11px] text-violet-300">توصية من قواعد ثابتة</span>
      </div>
      <p className="mb-3 text-xs text-slate-500">تُستنتج من الأرقام أعلاه بقواعد ثابتة، دون ذكاء اصطناعي. السبب مذكور مع كل اقتراح.</p>
      {suggestions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">لا إجراءات مقترحة: لا تنبيهات في بياناتك الآن.</p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((s) => {
            const { Icon, icon, label } = TONE[s.tone];
            return (
              <li key={s.id} className="flex items-start gap-2 rounded-lg border border-slate-800 p-3" data-testid="suggestion" data-id={s.id}>
                <Icon size={16} className={`mt-0.5 shrink-0 ${icon}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-100"><span className="sr-only">{label}: </span>{s.text}</p>
                  <p className="mt-0.5 text-xs text-slate-400">السبب: {s.reason}</p>
                </div>
                {s.href && <Link href={s.href} className="shrink-0 text-xs text-emerald-400 hover:underline">انتقل</Link>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
