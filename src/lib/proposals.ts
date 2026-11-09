import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiErrorMessage } from "./ai/config";
import { runAi } from "./ai/run";
import { AiError } from "./ai/types";
import {
  DRAFT_SCHEMA,
  DRAFT_SYSTEM,
  draftPrompt,
  mockDraft,
  parseDraft,
  type OutlineSection,
  type ProposalDraft,
} from "./proposal-draft";
import type { ProposalType } from "./types";

/**
 * Generates a structured proposal draft (summary + one body per planned section) from a brief,
 * through the cost-controlled AI runner (usage log, rate limits, duplicate guard, budget).
 */
export async function generateProposalDraft(
  supabase: SupabaseClient,
  opts: {
    proposalId: string;
    organizationId: string;
    brief: string;
    type: ProposalType;
    company: string;
    client: string;
    outline: OutlineSection[];
    force?: boolean;
  },
): Promise<ProposalDraft> {
  const result = await runAi(
    supabase,
    {
      organizationId: opts.organizationId,
      feature: "proposal_draft",
      hashParts: [opts.proposalId, opts.type, JSON.stringify(opts.outline), opts.client, opts.brief],
      force: opts.force,
    },
    {
      feature: "proposal_draft",
      system: DRAFT_SYSTEM,
      content: draftPrompt(opts),
      maxTokens: 8000,
      effort: "medium",
      jsonSchema: DRAFT_SCHEMA,
      mock: () => mockDraft(opts.outline, opts.client),
    },
  );
  try {
    return parseDraft(result.text, opts.outline);
  } catch {
    throw new AiError("invalid_output", aiErrorMessage("invalid_output"));
  }
}
