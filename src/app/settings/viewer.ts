import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user for the settings pages, read once per request (layout and page share it). */
export const getSettingsViewer = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return {
    supabase,
    userId: (data?.claims?.sub as string | undefined) ?? null,
    email: (data?.claims?.email as string | undefined) ?? "",
  };
});
