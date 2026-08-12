import { runStructured, type StructuredRun } from "@/lib/llm/structured";
import type { ModelProvider } from "@/lib/llm/types";
import type { Ticket } from "@/lib/ticket/schema";
import {
  buildExtractionPrompt,
  buildRepairPrompt,
  EXTRACTION_SYSTEM_PROMPT,
} from "./prompt";
import { buildQuotableText, parseExtraction, type ExtractedRequirements } from "./schema";

export type ExtractionRun = StructuredRun<ExtractedRequirements>;

export interface ExtractOptions {
  maxRepairs?: number;
  maxTokens?: number;
  now?: () => number;
}

/**
 * Runs requirement extraction with a bounded repair loop.
 *
 * Citations are checked against the ticket's own prose, so a quote the model
 * invented fails validation the same way a missing field would, and the
 * repair turn tells it exactly which quote did not hold up.
 */
export function extractRequirements(
  provider: ModelProvider,
  ticket: Ticket,
  options: ExtractOptions = {},
): Promise<ExtractionRun> {
  const quotableText = buildQuotableText(ticket);

  return runStructured<ExtractedRequirements>({
    provider,
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: buildExtractionPrompt(ticket),
    parse: (raw) => parseExtraction(raw, quotableText),
    buildRepairPrompt,
    ...options,
  });
}
