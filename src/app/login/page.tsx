import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/projects";
  const error = typeof params.error === "string" ? params.error : null;
  if (await getUserId()) redirect(next);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center">
        <Logo className="justify-center" />
        <span className="mx-auto mt-5 block h-0.5 w-16 bg-emerald-500" aria-hidden />
        <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
          The Ongoing Events team platform: projects, venues, proposals and field work, on one plan the whole team can see.
        </p>
        <p className="mt-1 max-w-sm text-sm text-slate-500" dir="rtl" lang="ar">منصة فريق Ongoing Events — المشاريع والمواقع والعروض والعمل الميداني في مكان واحد.</p>
      </div>
      {error && <p className="max-w-sm text-center text-sm text-red-400">{error}</p>}
      <LoginForm next={next} />
    </main>
  );
}
