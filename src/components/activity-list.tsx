import { describeActivity } from "@/lib/activity";
import { formatDate } from "@/lib/format";
import type { ActivityRow } from "@/lib/types";

function time(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(new Date(iso));
}
function day(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date(iso));
}

export function ActivityList({
  items,
  people,
  grouped = false,
}: {
  items: ActivityRow[];
  people: Map<string, string>;
  grouped?: boolean;
}) {
  if (items.length === 0) return <p className="text-sm text-slate-500">Nothing has happened yet.</p>;
  const groups = new Map<string, ActivityRow[]>();
  items.forEach((a) => {
    const k = grouped ? day(a.created_at) : "all";
    groups.set(k, [...(groups.get(k) ?? []), a]);
  });
  return (
    <div className="space-y-5" data-testid="activity">
      {[...groups.entries()].map(([k, list]) => (
        <section key={k}>
          {grouped && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{formatDate(k)}</h3>}
          <ul className="space-y-2">
            {list.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="w-12 shrink-0 pt-0.5 text-xs text-slate-500">{time(a.created_at)}</span>
                <p className="text-slate-300">
                  <span className="font-medium text-slate-100">
                    {a.actor_id ? (people.get(a.actor_id) ?? "Someone").split("@")[0] : "System"}
                  </span>{" "}
                  {describeActivity(a)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
