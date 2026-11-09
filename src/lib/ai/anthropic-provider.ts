import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage } from "./config";
import { AiError, type AiProvider, type AiRequest, type AiResult } from "./types";

/** Model is configurable; the default keeps the model this app has used so far. */
export const DEFAULT_MODEL = "claude-sonnet-5-5";

function mapError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.BadRequestError) {
    const msg = e.message ?? "";
    if (/input_tokens_exceeded|exceeds the allowed|too many|prompt is too long|too large/i.test(msg)) {
      return new AiError("too_large", aiErrorMessage("too_large"));
    }
    return new AiError("failed", aiErrorMessage("failed"));
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return new AiError("not_configured", aiErrorMessage("not_configured"));
  }
  if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) {
    return new AiError("overloaded", aiErrorMessage("overloaded"));
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new AiError("network", aiErrorMessage("network"));
  }
  return new AiError("failed", aiErrorMessage("failed"));
}

export function createAnthropicProvider(apiKey: string, model: string = process.env.AI_MODEL || DEFAULT_MODEL): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 180_000 });
  return {
    name: "anthropic",
    model,
    async generate(request: AiRequest): Promise<AiResult> {
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await client.beta.messages.create({
          model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: [{ role: "user", content: request.content }],
          output_config: {
            effort: request.effort ?? "medium",
            ...(request.jsonSchema ? { format: { type: "json_schema" as const, schema: request.jsonSchema } } : {}),
          },
          // If the model declines on policy grounds, the API retries on a suitable fallback model
          // within the same call instead of returning an empty refusal.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
      } catch (e) {
        throw mapError(e);
      }
      if (response.stop_reason === "refusal") throw new AiError("refused", aiErrorMessage("refused"));
      if (response.stop_reason === "max_tokens") throw new AiError("invalid_output", aiErrorMessage("invalid_output"));
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return {
        text,
        provider: "anthropic",
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      };
    },
  };
}
