import { sumCostUsd } from "@/lib/llm/cost";
import { addUsage, EMPTY_USAGE, type ModelProvider } from "@/lib/llm/types";
import { evaluatePlan } from "@/lib/evaluation/evaluate";
import { scoreEvaluation } from "@/lib/evaluation/schema";
import { planImplementation } from "@/lib/planning/plan";
import type { Ticket } from "@/lib/ticket/schema";
import { validatePlan } from "@/lib/validation/checks";
import type { RunArtifacts, StageRunRecord, WorkflowResult } from "./orchestrator";
import { recordApproval, recordEvent, repairBudgetExhausted, transition, type Run } from "./run";

/**
 * Re-plans after a human rejects a plan.
 *
 * This is the same repair path a failed rubric score takes, with one
 * difference that matters: the feedback is written by a person. Their note
 * becomes the priorFeedback the next plan is generated against, so a rejection
 * is an instruction rather than just a veto.
 */
export interface ReplanInput {
  provider: ModelProvider;
  ticket: Ticket;
  run: Run;
  artifacts: RunArtifacts;
  /** The reviewer's reason for rejecting. */
  note: string;
}

function toRecord(
  stage: StageRunRecord["stage"],
  round: number,
  run: { status: "success" | "failed"; attempts: unknown[]; totalUsage: ReturnType<typeof addUsage>; totalLatencyMs: number; totalEstimatedCostUsd: number | null; failureReason: string | null },
  violations: { path: string; message: string }[],
): StageRunRecord {
  return {
    stage,
    round,
    status: run.status,
    attempts: run.attempts.length,
    usage: run.totalUsage,
    latencyMs: run.totalLatencyMs,
    estimatedCostUsd: run.totalEstimatedCostUsd,
    failureReason: run.failureReason,
    violations,
  };
}

export async function replanAfterRejection(input: ReplanInput): Promise<WorkflowResult> {
  const { provider, ticket, note } = input;
  const artifacts: RunArtifacts = {
    ...input.artifacts,
    stageRuns: [...input.artifacts.stageRuns],
  };

  if (!artifacts.requirements) {
    throw new Error("Cannot replan without extracted requirements");
  }

  // Check the budget before spending it. Recording the rejection first would
  // consume a round and then discover there was none left, costing a round per
  // rejection and halving the real budget.
  if (repairBudgetExhausted(input.run)) {
    const failed = transition(
      input.run,
      "failed",
      "Repair budget exhausted — too many rejected plans for one run",
    );
    return finish(failed, artifacts);
  }

  // Rejection is modelled as a loop back to planning, not a terminal failure —
  // a rejected plan is feedback.
  let run = recordApproval(input.run, "rejected", note);

  const round = run.repairRounds;
  const feedback = note.trim()
    ? `A reviewer rejected the previous plan:\n${note.trim()}`
    : "A reviewer rejected the previous plan without giving a reason. Produce a materially different plan.";

  const planning = await planImplementation(provider, ticket, artifacts.requirements, {
    priorFeedback: feedback,
  });
  artifacts.stageRuns.push(
    toRecord("planning", round, planning, planning.attempts.flatMap((a) => a.violations)),
  );

  if (planning.status !== "success" || !planning.data) {
    run = transition(run, "failed", `Replanning failed: ${planning.failureReason}`);
    return finish(run, artifacts);
  }
  artifacts.plan = planning.data;

  run = transition(run, "validation", "Re-running deterministic checks");
  const validation = validatePlan(planning.data, artifacts.requirements);
  artifacts.validation = validation;
  run = recordEvent(
    run,
    validation.passed ? "stage_succeeded" : "stage_failed",
    `${validation.results.length} check(s): ${validation.failedCount} failed`,
  );

  if (!validation.passed) {
    run = transition(run, "failed", "Revised plan failed deterministic checks");
    return finish(run, artifacts);
  }

  run = transition(run, "evaluation", "Re-evaluating revised plan");
  const evaluation = await evaluatePlan(provider, ticket, artifacts.requirements, planning.data);
  artifacts.stageRuns.push(
    toRecord("evaluation", round, evaluation, evaluation.attempts.flatMap((a) => a.violations)),
  );

  if (evaluation.status !== "success" || !evaluation.data) {
    run = transition(run, "failed", `Re-evaluation failed: ${evaluation.failureReason}`);
    return finish(run, artifacts);
  }

  const verdict = scoreEvaluation(evaluation.data);
  artifacts.evaluation = verdict;
  run = recordEvent(
    run,
    verdict.passed ? "stage_succeeded" : "stage_failed",
    `Rubric average ${verdict.averageScore.toFixed(2)}`,
  );

  if (!verdict.passed) {
    run = transition(run, "failed", "Revised plan did not reach the rubric threshold");
    return finish(run, artifacts);
  }

  run = transition(run, "awaiting_approval", "Revised plan ready for approval");
  return finish(run, artifacts);
}

/** Approves a run: the one transition that ends it successfully. */
export function approveRun(run: Run, note: string): Run {
  return recordApproval(run, "approved", note);
}

function finish(run: Run, artifacts: RunArtifacts): WorkflowResult {
  const usage = artifacts.stageRuns.reduce((acc, r) => addUsage(acc, r.usage), EMPTY_USAGE);
  return {
    run,
    artifacts,
    totals: {
      usage,
      latencyMs: artifacts.stageRuns.reduce((acc, r) => acc + r.latencyMs, 0),
      estimatedCostUsd: sumCostUsd(artifacts.stageRuns.map((r) => r.estimatedCostUsd)),
      modelCalls: artifacts.stageRuns.reduce((acc, r) => acc + r.attempts, 0),
    },
  };
}
