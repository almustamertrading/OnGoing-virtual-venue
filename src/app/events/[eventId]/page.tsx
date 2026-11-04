import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, VenueRow } from "@/lib/types";
import { MembersPanel } from "./members-panel";
import { VenueCreator } from "./venue-creator";
import { DeleteEventButton } from "./delete-event-button";

export default async function EventPage({ params }: PageProps<"/events/[eventId]">) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string;
  const email = (claims?.claims?.email as string | undefined) ?? null;

  const [{ data: event }, { data: venues }, { data: memberRows }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
    supabase.from("venues").select("*").eq("event_id", eventId).order("created_at"),
    supabase.from("event_members").select("user_id, role").eq("event_id", eventId),
  ]);
  if (!event) notFound();

  const ids = (memberRows ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email").in("id", ids)
    : { data: [] as { id: string; email: string }[] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  const members = (memberRows ?? []).map((m) => ({
    user_id: m.user_id as string,
    role: m.role as MemberRole,
    email: emailById.get(m.user_id) ?? "Unknown user",
  }));
  const myRole = members.find((m) => m.user_id === userId)?.role;
  const canEdit = myRole === "owner" || myRole === "editor";

  return (
    <>
      <AppHeader email={email}>
        <Link href="/events" className="hover:text-white">Events</Link>
        <ChevronRight size={14} />
        <span className="truncate text-slate-200">{event.name}</span>
      </AppHeader>
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 py-8 md:grid-cols-[1fr_340px]">
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">{event.name}</h1>
            {event.description && <p className="mt-2 text-slate-400">{event.description}</p>}
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Venues</h2>
            {venues?.length === 0 && (
              <div className="card p-6 text-sm text-slate-400">
                No venues yet.{canEdit ? " Add the first one to open the map planner." : ""}
              </div>
            )}
            <ul className="space-y-3">
              {(venues as VenueRow[] | null)?.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/events/${eventId}/venues/${v.id}`}
                    className="card flex items-center gap-4 p-4 transition hover:border-emerald-700"
                  >
                    <MapPin size={18} className="text-emerald-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{v.name}</p>
                      {v.address && <p className="truncate text-xs text-slate-400">{v.address}</p>}
                    </div>
                    <span className="text-xs text-emerald-400">Open planner</span>
                    <ChevronRight size={18} className="text-slate-500" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {myRole === "owner" && <DeleteEventButton eventId={eventId} />}
        </section>
        <aside className="space-y-6">
          {canEdit && <VenueCreator eventId={eventId} />}
          <MembersPanel
            eventId={eventId}
            members={members}
            isOwner={myRole === "owner"}
            currentUserId={userId}
          />
        </aside>
      </main>
    </>
  );
}
