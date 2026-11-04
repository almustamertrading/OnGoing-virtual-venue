import Link from "next/link";
import { Logo } from "./logo";

export function AppHeader({ email, children }: { email?: string | null; children?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-800 bg-slate-950 px-4">
      <Link href="/events"><Logo /></Link>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-400">{children}</div>
      {email && <span className="hidden text-xs text-slate-500 sm:inline">{email}</span>}
      <form action="/auth/signout" method="post">
        <button className="btn-ghost py-1.5 text-xs" type="submit">Sign out</button>
      </form>
    </header>
  );
}
