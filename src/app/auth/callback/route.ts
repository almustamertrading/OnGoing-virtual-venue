import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

// Handles the link in Supabase emails (sign-up confirmation, password reset): PKCE code or token hash.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let error: string | null = null;
  if (code) {
    ({ error: error } = await supabase.auth
      .exchangeCodeForSession(code)
      .then((r) => ({ error: r.error?.message ?? null })));
  } else if (tokenHash && type) {
    ({ error: error } = await supabase.auth
      .verifyOtp({ type, token_hash: tokenHash })
      .then((r) => ({ error: r.error?.message ?? null })));
  } else {
    error = "The confirmation link is missing its token.";
  }

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }
  return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);
}
