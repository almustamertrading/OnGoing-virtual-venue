import Link from "next/link";
import { Logo } from "./logo";
import { MainNav } from "./main-nav";

export function AppHeader({ email, children }: { email?: string | null; children?: React.ReactNode }) {
  return (
    <header className="shrink-0 border-b border-slate-800 bg-slate-950">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link href="/projects" aria-label="All projects"><Logo compact /></Link>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-400">{children}</div>
        {email && <span className="hidden text-xs text-slate-500 lg:inline">{email}</span>}
        <form action="/auth/signout" method="post">
          <button className="btn-ghost py-1.5 text-xs" type="submit">Sign out</button>
        </form>
      </div>
      <div className="border-t border-slate-900 px-2 py-1">
        <MainNav />
      </div>
    </header>
  );
}
