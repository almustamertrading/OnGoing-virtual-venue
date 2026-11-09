"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "../actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label className="label" htmlFor="reset-email">Email</label>
        <input id="reset-email" name="email" type="email" required autoComplete="email" className="field" />
      </div>
      {state.error && <p className="text-sm text-red-400" role="alert">{state.error}</p>}
      {state.message && <p className="text-sm text-emerald-400" role="status">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Please wait…" : "Send reset link"}
      </button>
    </form>
  );
}
