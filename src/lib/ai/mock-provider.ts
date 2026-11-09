import type { AiProvider, AiRequest, AiResult } from "./types";

/**
 * Deterministic stand-in for tests and local development without an API key.
 * Enabled only by AI_PROVIDER=mock; its content is clearly marked as a test draft.
 */
export function createMockProvider(): AiProvider {
  return {
    name: "mock",
    model: "mock-provider",
    async generate(request: AiRequest): Promise<AiResult> {
      const delay = Number(process.env.AI_MOCK_DELAY_MS ?? 0);
      if (delay > 0) await new Promise((r) => setTimeout(r, Math.min(delay, 10_000)));
      const text = JSON.stringify(request.mock ? request.mock() : {});
      const input = typeof request.content === "string" ? request.content : JSON.stringify(request.content);
      return {
        text,
        provider: "mock",
        model: "mock-provider",
        inputTokens: Math.ceil((request.system.length + input.length) / 4),
        outputTokens: Math.ceil(text.length / 4),
        cacheReadTokens: 0,
      };
    },
  };
}
