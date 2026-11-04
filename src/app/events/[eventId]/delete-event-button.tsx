"use client";

import { useTransition } from "react";
import { deleteEvent } from "../actions";

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-danger text-xs"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this event and every venue, layer, comment and photo in it?")) {
          start(() => deleteEvent(eventId));
        }
      }}
    >
      {pending ? "Deleting…" : "Delete event"}
    </button>
  );
}
