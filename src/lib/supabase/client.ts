import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

/**
 * Loads the session and gives its token to Realtime. Call before subscribing to
 * postgres_changes: a channel joined without it runs as an anonymous visitor,
 * and row-level security then hides every change.
 */
export async function withRealtimeAuth(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.realtime.setAuth(data.session.access_token);
}
