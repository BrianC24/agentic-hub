import { estimateCostUsd, sumCostUsd } from "./cost";
import {
  addUsage,
  EMPTY_USAGE,
  ModelProviderError,
  type ModelMessage,
  type ModelProvider,
  type ModelUsage,
} from "./types";

/** A single way in which model output failed to satisfy its contract. */
export interface SchemaViolation {
  path: string;
  message: string;
}

export type StructuredParseResult<T> =
  | { success: true; data: T }
  | { success: false; violations: SchemaViolation[] };

/**
 * Why an attempt ended. Distinguishing these matters for the run report: a
 * schema violation is a repairable model error, a provider failure is not.
 */
export type AttemptOutcome = "valid" | "schema_violation" | "provider_error";

export interface StructuredAttempt {
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

export interface StructuredRun<T> {
  status: "success" | "failed";
  data: T | null;
  /** Set when status is "failed": why the loop gave up. */
  failureReason: "retries_exhausted" | "provider_error" | null;
  attempts: StructuredAttempt[];
  totalUsage: ModelUsage;
  totalLatencyMs: number;
  totalEstimatedCostUsd: number | null;
  model: string;
}

export interface StructuredRunOptions<T> {
  provider: ModelProvider;
  system: string;
  /** The first user turn. */
  prompt: string;
  /** Validates raw model text. Owns both structural and semantic rules. */
  parse: (raw: string) => StructuredParseResult<T>;
  /** Builds the follow-up turn that asks the model to fix what it got wrong. */
  buildRepairPrompt: (violations: SchemaViolation[]) => string;
  /** Repairs allowed after the first attempt. Total calls = maxRepairs + 1. */
  maxRepairs?: number;
  maxTokens?: number;
  /** Injectable clock so latency assertions in tests are deterministic. */
  now?: () => number;
}

export const DEFAULT_MAX_REPAIRS = 2;
export const DEFAULT_MAX_TOKENS = 16_000;

/**
 * Calls a model and validates the result, retrying with error feedback.
 *
 * The loop is bounded three independent ways: a hard attempt ceiling, an exit
 * as soon as output validates, and an immediate abort on a non-retryable
 * provider error. There is no path where this runs unbounded.
 *
 * On a validation failure the model's own invalid output and the specific
 * violations are appended to the conversation, so the next attempt is a
 * correction rather than a reroll of the same prompt.
 */
export async function runStructured<T>(options: StructuredRunOptions<T>): Promise<StructuredRun<T>> {
  const {
    provider,
    system,
    prompt,
    parse,
    buildRepairPrompt,
    maxRepairs = DEFAULT_MAX_REPAIRS,
    maxTokens = DEFAULT_MAX_TOKENS,
    now = () => Date.now(),
  } = options;

  const messages: ModelMessage[] = [{ role: "user", content: prompt }];
  const attempts: StructuredAttempt[] = [];
  const maxAttempts = maxRepairs + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = now();

    let responseText: string;
    let usage: ModelUsage;
    try {
      const response = await provider.complete({ system, messages, maxTokens });
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
      // transport concern with its own backoff policy, not this loop's job.
      // Either way the loop stops rather than burning repair budget on it.
      const retryable = error instanceof ModelProviderError && error.retryable;
      if (!retryable || attempt === maxAttempts) {
        return finalize<T>(attempts, provider.model, "failed", null, "provider_error");
      }
      continue;
    }

    const latencyMs = now() - startedAt;
    const parsed = parse(responseText);
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
      return finalize<T>(attempts, provider.model, "success", parsed.data, null);
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

    messages.push({ role: "assistant", content: responseText });
    messages.push({ role: "user", content: buildRepairPrompt(parsed.violations) });
  }

  return finalize<T>(attempts, provider.model, "failed", null, "retries_exhausted");
}

function finalize<T>(
  attempts: StructuredAttempt[],
  model: string,
  status: StructuredRun<T>["status"],
  data: T | null,
  failureReason: StructuredRun<T>["failureReason"],
): StructuredRun<T> {
  return {
    status,
    data,
    failureReason,
    attempts,
    totalUsage: attempts.reduce((acc, a) => addUsage(acc, a.usage), EMPTY_USAGE),
    totalLatencyMs: attempts.reduce((acc, a) => acc + a.latencyMs, 0),
    totalEstimatedCostUsd: sumCostUsd(attempts.map((a) => a.estimatedCostUsd)),
    model,
  };
}

export function formatViolations(violations: SchemaViolation[]): string {
  return violations.map((v) => `- ${v.path}: ${v.message}`).join("\n");
}
