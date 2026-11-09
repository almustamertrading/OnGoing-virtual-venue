import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnthropicProvider } from "./anthropic-provider";
import { aiErrorMessage, checkAttempts, chooseProvider, readAiLimits, requestHash } from "./config";
import { createMockProvider } from "./mock-provider";
import { AiError, type AiFeature, type AiRequest, type AiResult } from "./types";

export type AiRunContext = {
  organizationId: string | null;
  feature: AiFeature;
  /** What makes two requests "the same" (e.g. proposal id + brief, or the file's bytes). */
  hashParts: string[];
  /** Run even if an identical request succeeded moments ago. */
  force?: boolean;
};

/**
 * Runs one AI request with cost controls: per-user rate limits, an organisation monthly token
 * budget, a duplicate guard (database-enforced for concurrent repeats) and a usage log row
 * (provider, model, tokens, latency, error) for every attempt. Uses the signed-in user's client,
 * so the log is written under RLS.
 */
export async function runAi(supabase: SupabaseClient, ctx: AiRunContext, request: AiRequest): Promise<AiResult> {
  const choice = chooseProvider();
  if (!choice) throw new AiError("not_configured", aiErrorMessage("not_configured"));
  const provider = choice === "mock" ? createMockProvider() : createAnthropicProvider(process.env.ANTHROPIC_API_KEY as string);

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) throw new AiError("failed", "انتهت الجلسة. سجّل الدخول من جديد.");

  const limits = readAiLimits();
  const now = Date.now();
  const hash = requestHash(ctx.feature, ctx.hashParts);

  // Requests that never finished (server crash, timeout) stop blocking after a while.
  await supabase
    .from("ai_usage_logs")
    .update({ status: "error", error_code: "abandoned", finished_at: new Date(now).toISOString() })
    .eq("user_id", userId)
    .eq("status", "started")
    .lt("created_at", new Date(now - limits.staleStartedMinutes * 60_000).toISOString());

  const { data: attempts } = await supabase
    .from("ai_usage_logs")
    .select("status, request_hash, created_at")
    .eq("user_id", userId)
    .eq("feature", ctx.feature)
    .gte("created_at", new Date(now - 24 * 60 * 60_000).toISOString());

  const decision = checkAttempts(attempts ?? [], ctx.feature, hash, limits, now, ctx.force);
  if (!decision.ok) {
    if (decision.code === "rate_limited") {
      await supabase.from("ai_usage_logs").insert({
        organization_id: ctx.organizationId, feature: ctx.feature, provider: provider.name, model: provider.model,
        request_hash: hash, status: "rate_limited", error_code: "rate_limited", finished_at: new Date(now).toISOString(),
      });
    }
    throw new AiError(decision.code, aiErrorMessage(decision.code, { minutesAgo: decision.minutesAgo }));
  }

  if (ctx.organizationId) {
    const { data: used } = await supabase.rpc("ai_org_tokens_this_month", { org: ctx.organizationId });
    if (typeof used === "number" && used >= limits.orgMonthlyTokens) {
      throw new AiError("budget_exceeded", aiErrorMessage("budget_exceeded"));
    }
  }

  const { data: row, error: insertError } = await supabase
    .from("ai_usage_logs")
    .insert({ organization_id: ctx.organizationId, feature: ctx.feature, provider: provider.name, model: provider.model, request_hash: hash })
    .select("id")
    .single();
  if (insertError?.code === "23505") throw new AiError("in_progress", aiErrorMessage("in_progress"));
  if (insertError || !row) throw new AiError("failed", aiErrorMessage("failed"));

  const started = Date.now();
  try {
    const result = await provider.generate(request);
    await supabase
      .from("ai_usage_logs")
      .update({
        status: "success", model: result.model, input_tokens: result.inputTokens, output_tokens: result.outputTokens,
        cache_read_tokens: result.cacheReadTokens, latency_ms: Date.now() - started, finished_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return result;
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("failed", aiErrorMessage("failed"));
    await supabase
      .from("ai_usage_logs")
      .update({
        status: err.code === "refused" ? "refused" : "error", error_code: err.code,
        latency_ms: Date.now() - started, finished_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    throw err;
  }
}
