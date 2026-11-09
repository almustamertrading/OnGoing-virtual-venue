import Link from "next/link";
import { Logo } from "@/components/logo";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Reset password | OnGoing" };

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <Logo className="justify-center" />
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold text-white">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-400">We will email you a link to set a new password.</p>
        <ResetForm />
        <Link href="/login" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">Back to sign in</Link>
      </div>
    </main>
  );
}
