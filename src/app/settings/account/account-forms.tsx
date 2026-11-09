"use client";

import { useActionState, useState, useTransition } from "react";
import { KeyRound, LogOut, MonitorSmartphone } from "lucide-react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { changePassword, signOutEverywhere, signOutOtherDevices, type AccountState } from "./actions";

export function AccountForms({ recovery }: { recovery: boolean }) {
  return (
    <div className="mt-6 space-y-5">
      <ChangePassword recovery={recovery} />
      <Sessions />
    </div>
  );
}

function ChangePassword({ recovery }: { recovery: boolean }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePassword, {});
  return (
    <section className="card p-5" aria-labelledby="pw-title">
      <h2 id="pw-title" className="flex items-center gap-2 font-semibold text-white">
        <KeyRound size={16} className="text-emerald-300" aria-hidden /> {recovery ? "تعيين كلمة مرور جديدة" : "تغيير كلمة المرور"}
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        {MIN_PASSWORD_LENGTH} حرفًا على الأقل. بعد التغيير يُسجَّل الخروج من كل الأجهزة الأخرى.
      </p>
      <form action={action} className="mt-4 space-y-3" key={state.message ?? "form"}>
        {!recovery && (
          <div>
            <label className="label" htmlFor="current_password">كلمة المرور الحالية</label>
            <input id="current_password" name="current_password" type="password" required autoComplete="current-password" className="field" dir="ltr" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="new_password">كلمة المرور الجديدة</label>
          <input id="new_password" name="new_password" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className="field" dir="ltr" />
        </div>
        <div>
          <label className="label" htmlFor="confirm_password">تأكيد كلمة المرور الجديدة</label>
          <input id="confirm_password" name="confirm_password" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className="field" dir="ltr" />
        </div>
        {state.error && <p className="text-sm text-red-400" role="alert">{state.error}</p>}
        {state.message && <p className="text-sm text-emerald-400" role="status">{state.message}</p>}
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}</button>
      </form>
    </section>
  );
}

function Sessions() {
  const [busy, start] = useTransition();
  const [result, setResult] = useState<AccountState>({});
  return (
    <section className="card p-5" aria-labelledby="sessions-title">
      <h2 id="sessions-title" className="flex items-center gap-2 font-semibold text-white">
        <MonitorSmartphone size={16} className="text-emerald-300" aria-hidden /> الجلسات والأجهزة
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        إن شككت أن أحدًا استخدم حسابك، سجّل الخروج من كل الأجهزة ثم غيّر كلمة المرور.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => start(async () => setResult(await signOutOtherDevices()))}>
          <MonitorSmartphone size={15} aria-hidden /> الخروج من الأجهزة الأخرى
        </button>
        <button
          type="button"
          className="btn-ghost text-red-300 hover:text-red-200"
          disabled={busy}
          onClick={() => confirm("تسجيل الخروج من كل الأجهزة بما فيها هذا الجهاز؟") && start(() => signOutEverywhere())}
        >
          <LogOut size={15} aria-hidden /> الخروج من كل الأجهزة
        </button>
      </div>
      {result.error && <p className="mt-2 text-sm text-red-400" role="alert">{result.error}</p>}
      {result.message && <p className="mt-2 text-sm text-emerald-400" role="status">{result.message}</p>}
    </section>
  );
}
