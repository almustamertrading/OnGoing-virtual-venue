import type Anthropic from "@anthropic-ai/sdk";

export type AiFeature = "rfp_extract" | "proposal_draft" | "tender_analysis";
export const AI_FEATURES: readonly AiFeature[] = ["rfp_extract", "proposal_draft", "tender_analysis"];

export type AiErrorCode =
  | "not_configured"
  | "rate_limited"
  | "budget_exceeded"
  | "duplicate"
  | "in_progress"
  | "refused"
  | "too_large"
  | "overloaded"
  | "timeout"
  | "network"
  | "invalid_output"
  | "failed";

/** An AI failure with a code the UI can explain. Never carries provider secrets. */
export class AiError extends Error {
  constructor(readonly code: AiErrorCode, message: string) {
    super(message);
    this.name = "AiError";
  }
}

export type AiRequest = {
  feature: AiFeature;
  system: string;
  content: Anthropic.Beta.BetaUserMessageParam["content"];
  maxTokens: number;
  effort?: "low" | "medium" | "high";
  /** JSON Schema for structured output; the response text is then valid JSON. */
  jsonSchema?: Record<string, unknown>;
  /** Builds the placeholder payload returned by the mock provider (tests and local dev only). */
  mock?: () => unknown;
};

export type AiResult = {
  text: string;
  provider: "anthropic" | "mock";
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

/** Replaceable AI backend. The app depends on this interface, not on a vendor SDK. */
export interface AiProvider {
  readonly name: "anthropic" | "mock";
  readonly model: string;
  generate(request: AiRequest): Promise<AiResult>;
}
