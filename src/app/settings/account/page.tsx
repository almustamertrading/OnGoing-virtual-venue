import { redirect } from "next/navigation";
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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-white">الحساب والأمان</h1>
      <p className="mt-1 text-sm text-slate-400" dir="ltr">{email}</p>
      <AccountForms recovery={recovery} />
    </div>
  );
}
