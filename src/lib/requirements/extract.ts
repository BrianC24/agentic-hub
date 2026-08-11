import { estimateCostUsd, sumCostUsd } from "@/lib/llm/cost";
import {
  addUsage,
  EMPTY_USAGE,
  ModelProviderError,
  type ModelMessage,
  type ModelProvider,
  type ModelUsage,
} from "@/lib/llm/types";
import type { Ticket } from "@/lib/ticket/schema";
import {
  buildExtractionPrompt,
  buildRepairPrompt,
  EXTRACTION_SYSTEM_PROMPT,
} from "./prompt";
import {
  buildQuotableText,
  parseExtraction,
  type ExtractedRequirements,
  type SchemaViolation,
} from "./schema";

/**
 * Why an attempt ended. Distinguishing these matters for the run report: a
 * schema violation is a repairable model error, a provider failure is not.
 */
export type AttemptOutcome = "valid" | "schema_violation" | "provider_error";

export interface ExtractionAttempt {
  /** 1-indexed. Attempt 1 is the initial call; later attempts are repairs. */
  attempt: number;
  outcome: AttemptOutcome;
  /** Raw model text, kept verbatim so a failed run is inspectable. */
  raw: string | null;
  violations: SchemaViolation[];
  providerError: string | null;
  usage: ModelUsage;
  latencyMs: number;
  estimatedCostUsd: number | null;
}

export interface ExtractionRun {
  status: "success" | "failed";
  requirements: ExtractedRequirements | null;
  /** Set when status is "failed" — why the loop gave up. */
  failureReason: "retries_exhausted" | "provider_error" | null;
  attempts: ExtractionAttempt[];
  totalUsage: ModelUsage;
  totalLatencyMs: number;
  totalEstimatedCostUsd: number | null;
  model: string;
}

export interface ExtractOptions {
  /** Repairs allowed after the first attempt. Total calls = maxRepairs + 1. */
  maxRepairs?: number;
  maxTokens?: number;
  /** Injectable clock so latency assertions in tests are deterministic. */
  now?: () => number;
}

export const DEFAULT_MAX_REPAIRS = 2;
const DEFAULT_MAX_TOKENS = 16_000;

/**
 * Runs requirement extraction with a bounded repair loop.
 *
 * The loop is bounded three ways: a hard attempt ceiling, an exit as soon as
 * output validates, and an immediate abort on a non-retryable provider error.
 * There is no path where this runs unbounded.
 */
export async function extractRequirements(
  provider: ModelProvider,
  ticket: Ticket,
  options: ExtractOptions = {},
): Promise<ExtractionRun> {
  const maxRepairs = options.maxRepairs ?? DEFAULT_MAX_REPAIRS;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const now = options.now ?? (() => Date.now());

  const messages: ModelMessage[] = [
    { role: "user", content: buildExtractionPrompt(ticket) },
  ];

  // Citations are checked against the ticket's own prose, so a quote invented
  // by the model fails validation the same way a missing field would.
  const quotableText = buildQuotableText(ticket);

  const attempts: ExtractionAttempt[] = [];
  const maxAttempts = maxRepairs + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = now();

    let responseText: string;
    let usage: ModelUsage;
    try {
      const response = await provider.complete({
        system: EXTRACTION_SYSTEM_PROMPT,
        messages,
        maxTokens,
      });
      responseText = response.text;
      usage = response.usage;
    } catch (error) {
      const latencyMs = now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({
        attempt,
        outcome: "provider_error",
        raw: null,
        violations: [],
        providerError: message,
        usage: EMPTY_USAGE,
        latencyMs,
        estimatedCostUsd: estimateCostUsd(provider.model, EMPTY_USAGE),
      });

      // A retryable provider error could justify another attempt, but that is a
      // transport concern with its own backoff policy — not this loop's job.
      // Either way the loop stops here rather than burning repair budget.
      const retryable = error instanceof ModelProviderError && error.retryable;
      if (!retryable || attempt === maxAttempts) {
        return finalize(attempts, provider.model, "failed", null, "provider_error");
      }
      continue;
    }

    const latencyMs = now() - startedAt;
    const parsed = parseExtraction(responseText, quotableText);
    const estimatedCostUsd = estimateCostUsd(provider.model, usage);

    if (parsed.success) {
      attempts.push({
        attempt,
        outcome: "valid",
        raw: responseText,
        violations: [],
        providerError: null,
        usage,
        latencyMs,
        estimatedCostUsd,
      });
      return finalize(attempts, provider.model, "success", parsed.data, null);
    }

    attempts.push({
      attempt,
      outcome: "schema_violation",
      raw: responseText,
      violations: parsed.violations,
      providerError: null,
      usage,
      latencyMs,
      estimatedCostUsd,
    });

    // Feed the invalid output and the specific violations back as conversation
    // so the next attempt is a correction, not a reroll of the same prompt.
    messages.push({ role: "assistant", content: responseText });
    messages.push({ role: "user", content: buildRepairPrompt(parsed.violations) });
  }

  return finalize(attempts, provider.model, "failed", null, "retries_exhausted");
}

function finalize(
  attempts: ExtractionAttempt[],
  model: string,
  status: ExtractionRun["status"],
  requirements: ExtractedRequirements | null,
  failureReason: ExtractionRun["failureReason"],
): ExtractionRun {
  return {
    status,
    requirements,
    failureReason,
    attempts,
    totalUsage: attempts.reduce((acc, a) => addUsage(acc, a.usage), EMPTY_USAGE),
    totalLatencyMs: attempts.reduce((acc, a) => acc + a.latencyMs, 0),
    totalEstimatedCostUsd: sumCostUsd(attempts.map((a) => a.estimatedCostUsd)),
    model,
  };
}
