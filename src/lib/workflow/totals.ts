import { sumCostUsd } from "@/lib/llm/cost";
import { addUsage, EMPTY_USAGE, type ModelUsage } from "@/lib/llm/types";
import type { StageRunRecord } from "./orchestrator";

export interface RunTotals {
  usage: ModelUsage;
  latencyMs: number;
  estimatedCostUsd: number | null;
  modelCalls: number;
}

/**
 * The one place run totals are computed.
 *
 * Previously duplicated across the orchestrator, the replan path, and the
 * decision route, which meant three reducers that could disagree about what a
 * run cost — and the report would show whichever one happened to produce it.
 */
export function summarizeTotals(stageRuns: StageRunRecord[]): RunTotals {
  return {
    usage: stageRuns.reduce((acc, r) => addUsage(acc, r.usage), EMPTY_USAGE),
    latencyMs: stageRuns.reduce((acc, r) => acc + r.latencyMs, 0),
    // Propagates null: one unpriced stage makes the whole run's cost unknown,
    // which is the honest answer rather than a total that silently omits it.
    estimatedCostUsd: sumCostUsd(stageRuns.map((r) => r.estimatedCostUsd)),
    modelCalls: stageRuns.reduce((acc, r) => acc + r.attempts, 0),
  };
}
