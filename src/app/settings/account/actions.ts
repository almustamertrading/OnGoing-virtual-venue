"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRecentEmailLogin, validateNewPassword } from "@/lib/password-policy";

export type AccountState = { error?: string; message?: string };

/**
 * Changes the signed-in user's password. Normally the current password is checked first, so a
 * borrowed or stolen session cannot lock the owner out. After an email reset link (recent
 * recovery/OTP login) the current password is not required. Other sessions are signed out.
 */
export async function changePassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.email) return { error: "انتهت الجلسة. سجّل الدخول من جديد." };

  const recovery = isRecentEmailLogin(claims.amr);
  const invalid = validateNewPassword(next, confirm, recovery ? null : current);
  if (invalid) return { error: invalid };

  if (!recovery) {
    const { error } = await supabase.auth.signInWithPassword({ email: claims.email as string, password: current });
    if (error) return { error: "كلمة المرور الحالية غير صحيحة." };
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };

  // Revoke every other session (refresh tokens). Access tokens already issued expire on their own.
  await supabase.auth.signOut({ scope: "others" });
  return { message: "تم تغيير كلمة المرور وتسجيل الخروج من كل الأجهزة الأخرى." };
}

export async function signOutOtherDevices(): Promise<AccountState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: error.message };
  return { message: "تم تسجيل الخروج من كل الأجهزة الأخرى." };
}

export async function signOutEverywhere() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?notice=" + encodeURIComponent("Signed out of every device."));
}
