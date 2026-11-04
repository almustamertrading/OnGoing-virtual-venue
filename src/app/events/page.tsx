import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";
import { CreateEventForm } from "./create-event-form";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? null;

  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, description, start_date, end_date, created_by, created_at, venues(count)")
    .order("created_at", { ascending: false });

  return (
    <>
      <AppHeader email={email} />
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 py-8 md:grid-cols-[1fr_320px]">
        <section>
          <h1 className="mb-4 text-2xl font-semibold text-white">Your events</h1>
          {error && <p className="text-sm text-red-400">{error.message}</p>}
          {events?.length === 0 && (
            <div className="card p-8 text-center text-slate-400">
              No events yet. Create one to start mapping venues.
            </div>
          )}
          <ul className="space-y-3">
            {(events as (EventRow & { venues: { count: number }[] })[] | null)?.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className="card flex items-center gap-4 p-4 transition hover:border-emerald-700"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{e.name}</p>
                    <p className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                      {e.start_date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays size={12} />
                          {e.start_date}
                          {e.end_date && e.end_date !== e.start_date ? ` – ${e.end_date}` : ""}
                        </span>
                      )}
                      <span>
                        {e.venues?.[0]?.count ?? 0} venue{(e.venues?.[0]?.count ?? 0) === 1 ? "" : "s"}
                      </span>
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-slate-500" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <aside>
          <CreateEventForm />
        </aside>
      </main>
    </>
  );
}
