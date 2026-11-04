import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/events";
  const error = typeof params.error === "string" ? params.error : null;
  if (await getUserId()) redirect(next);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center">
        <Logo className="justify-center" />
        <p className="mt-3 max-w-sm text-sm text-slate-400">
          Plan venues on a live map, inspect them in 360°, and work on the same plan as your whole team.
        </p>
      </div>
      {error && <p className="max-w-sm text-center text-sm text-red-400">{error}</p>}
      <LoginForm next={next} />
    </main>
  );
}
