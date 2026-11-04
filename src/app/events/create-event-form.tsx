"use client";

import { useActionState } from "react";
import { createEvent, type ActionState } from "./actions";

export function CreateEventForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createEvent, {});
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-semibold text-white">New event</h2>
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" name="name" required placeholder="e.g. Regional Cup Final 2027" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={2} className="field" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="start_date">Starts</label>
          <input id="start_date" name="start_date" type="date" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="end_date">Ends</label>
          <input id="end_date" name="end_date" type="date" className="field" />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Creating…" : "Create event"}
      </button>
    </form>
  );
}
