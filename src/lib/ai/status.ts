import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chooseProvider, readAiLimits } from "./config";
import type { AiFeature } from "./types";

export type AiStatus = {
  /** Which backend would serve a request now; null when no provider is configured. */
  provider: "anthropic" | "mock" | null;
  usedThisHour: number;
  perHour: number;
  usedToday: number;
  perDay: number;
};

/** The signed-in user's quota for one AI feature, from their own usage log rows (RLS). */
export async function getAiStatus(supabase: SupabaseClient, feature: AiFeature): Promise<AiStatus> {
  const limits = readAiLimits();
  const now = Date.now();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const { data } = userId
    ? await supabase
        .from("ai_usage_logs")
        .select("status, created_at")
        .eq("user_id", userId)
        .eq("feature", feature)
        .gte("created_at", new Date(now - 24 * 60 * 60_000).toISOString())
    : { data: [] };
  const counted = ((data ?? []) as { status: string; created_at: string }[]).filter((r) => r.status !== "rate_limited");
  return {
    provider: chooseProvider(),
    usedThisHour: counted.filter((r) => Date.parse(r.created_at) >= now - 60 * 60_000).length,
    perHour: limits.perHour[feature],
    usedToday: counted.length,
    perDay: limits.perDay[feature],
  };
}
