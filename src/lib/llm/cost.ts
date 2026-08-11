import type { ModelUsage } from "./types";

/**
 * Published list prices in USD per million tokens, as of 2026-08-10.
 *
 * These are list rates, not a negotiated contract price, so every figure the UI
 * shows is labelled "estimated". Prices are checked in deliberately rather than
 * fetched: a run report should reproduce the number it was computed with.
 */
export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-5": { inputPerMillion: 5, outputPerMillion: 25 },
  "claude-sonnet-5": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku-4-5": { inputPerMillion: 1, outputPerMillion: 5 },
  // Priced at zero so mock-driven test runs report a real $0.00 rather than
  // silently falling through to "unknown".
  "mock-model": { inputPerMillion: 0, outputPerMillion: 0 },
};

export function getPricing(model: string): ModelPricing | undefined {
  return MODEL_PRICING[model];
}

/**
 * Estimated cost in USD. Returns null for an unpriced model rather than
 * guessing — an unknown cost must render as "unknown", never as $0.00.
 */
export function estimateCostUsd(model: string, usage: ModelUsage): number | null {
  const pricing = getPricing(model);
  if (!pricing) return null;

  const input = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const output = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  return input + output;
}

/** Sums estimates, propagating null if any single estimate is unknown. */
export function sumCostUsd(costs: Array<number | null>): number | null {
  let total = 0;
  for (const cost of costs) {
    if (cost === null) return null;
    total += cost;
  }
  return total;
}

export function formatCostUsd(cost: number | null): string {
  if (cost === null) return "unknown";
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `<$0.01`;
  return `$${cost.toFixed(2)}`;
}
