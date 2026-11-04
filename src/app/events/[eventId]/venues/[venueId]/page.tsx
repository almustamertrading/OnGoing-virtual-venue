import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, VenueRow } from "@/lib/types";
import { EditorLoader } from "@/components/editor/editor-loader";

export default async function VenuePage({ params }: PageProps<"/events/[eventId]/venues/[venueId]">) {
  const { eventId, venueId } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string;
  const email = (claims?.claims?.email as string | undefined) ?? "";

  const [{ data: event }, { data: venue }, { data: member }] = await Promise.all([
    supabase.from("events").select("id, name").eq("id", eventId).maybeSingle(),
    supabase.from("venues").select("*").eq("id", venueId).eq("event_id", eventId).maybeSingle(),
    supabase.from("event_members").select("role").eq("event_id", eventId).eq("user_id", userId).maybeSingle(),
  ]);
  if (!event || !venue || !member) notFound();

  return (
    <EditorLoader
      eventId={eventId}
      eventName={event.name}
      venue={venue as VenueRow}
      role={member.role as MemberRole}
      userId={userId}
      email={email}
    />
  );
}
