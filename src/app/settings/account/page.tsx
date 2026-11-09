import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { isRecentEmailLogin } from "@/lib/password-policy";
import { createClient } from "@/lib/supabase/server";
import { AccountForms } from "./account-forms";

export const metadata = { title: "الحساب | OnGoing" };

export default async function AccountPage({ searchParams }: PageProps<"/settings/account">) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login?next=/settings/account");
  const email = (claims.email as string | undefined) ?? "";
  const recovery = params.reset === "1" && isRecentEmailLogin(claims.amr);

  return (
    <>
      <AppHeader email={email}>
        <Link href="/projects" className="hover:text-white">Projects</Link>
        <ChevronRight size={14} />
        <span className="text-slate-200">الحساب</span>
      </AppHeader>
      <main dir="rtl" className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-semibold text-white">الحساب والأمان</h1>
        <p className="mt-1 text-sm text-slate-400" dir="ltr">{email}</p>
        <AccountForms recovery={recovery} />
      </main>
    </>
  );
}
