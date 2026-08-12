import type { ModelProvider, ModelUsage } from "@/lib/llm/types";
import type { StructuredRun } from "@/lib/llm/structured";
import { evaluatePlan } from "@/lib/evaluation/evaluate";
import { scoreEvaluation, type Evaluation, type EvaluationVerdict } from "@/lib/evaluation/schema";
import { planImplementation } from "@/lib/planning/plan";
import type { ImplementationPlan } from "@/lib/planning/schema";
import { extractRequirements } from "@/lib/requirements/extract";
import type { ExtractedRequirements } from "@/lib/requirements/schema";
import type { Ticket } from "@/lib/ticket/schema";
import { formatFailedChecks, validatePlan, type ValidationReport } from "@/lib/validation/checks";
import {
  createRun,
  MAX_REPAIR_ROUNDS,
  recordEvent,
  transition,
  type Run,
} from "./run";
import { summarizeTotals, type RunTotals } from "./totals";

/**
 * Everything one workflow execution produced.
 *
 * Kept separate from `Run` (the state machine) so the state can be advanced and
 * asserted on without dragging model output around, and so a recording can
 * serialise the artefacts independently of the transitions.
 */
export interface RunArtifacts {
  requirements: ExtractedRequirements | null;
  plan: ImplementationPlan | null;
  validation: ValidationReport | null;
  evaluation: EvaluationVerdict | null;
  /** Every model call the run made, in order, for the trace view. */
  stageRuns: StageRunRecord[];
}

export interface StageRunRecord {
  stage: "requirements" | "planning" | "evaluation";
  /** Which repair round this belongs to; 0 is the first pass. */
  round: number;
  status: "success" | "failed";
  attempts: number;
  usage: ModelUsage;
  latencyMs: number;
  estimatedCostUsd: number | null;
  failureReason: string | null;
  violations: { path: string; message: string }[];
}

export interface WorkflowResult {
  run: Run;
  artifacts: RunArtifacts;
  totals: RunTotals;
}

export interface WorkflowOptions {
  /** Bound on plan→evaluate→replan cycles. */
  maxRepairRounds?: number;
  now?: () => number;
  runId?: string;
}

function toRecord(
  stage: StageRunRecord["stage"],
  round: number,
  run: StructuredRun<unknown>,
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
    violations: run.attempts.flatMap((a) => a.violations),
  };
}

/**
 * Drives a ticket through the workflow up to the approval gate.
 *
 * The loop that matters is plan → deterministic checks → model evaluation.
 * A plan that fails either is sent back to planning with the specific reasons
 * attached, bounded by maxRepairRounds. The run stops at awaiting_approval
 * rather than completing itself: approval is a human decision by design.
 */
export async function runWorkflow(
  provider: ModelProvider,
  ticket: Ticket,
  options: WorkflowOptions = {},
): Promise<WorkflowResult> {
  const maxRepairRounds = options.maxRepairRounds ?? MAX_REPAIR_ROUNDS;
  const now = options.now ?? (() => Date.now());
  const runId = options.runId ?? `run_${now().toString(36)}`;

  let run = createRun(runId, ticket, now());
  const artifacts: RunArtifacts = {
    requirements: null,
    plan: null,
    validation: null,
    evaluation: null,
    stageRuns: [],
  };

  // --- Requirements -------------------------------------------------------
  run = transition(run, "requirements", "Extracting requirements", now());
  const extraction = await extractRequirements(provider, ticket);
  artifacts.stageRuns.push(toRecord("requirements", 0, extraction));

  if (extraction.status !== "success" || !extraction.data) {
    run = transition(run, "failed", `Requirement extraction failed: ${extraction.failureReason}`, now());
    return finish(run, artifacts);
  }
  artifacts.requirements = extraction.data;
  run = recordEvent(
    run,
    "stage_succeeded",
    `Extracted ${extraction.data.explicitRequirements.length} explicit requirement(s), ` +
      `${extraction.data.ambiguities.length} ambiguity(ies)`,
    now(),
  );

  // --- Plan / validate / evaluate, bounded ---------------------------------
  let priorFeedback: string | undefined;

  for (let round = 0; round <= maxRepairRounds; round += 1) {
    run = transition(run, "planning", round === 0 ? "Planning implementation" : `Replanning (round ${round})`, now());

    const planning = await planImplementation(provider, ticket, artifacts.requirements, {
      priorFeedback,
    });
    artifacts.stageRuns.push(toRecord("planning", round, planning));

    if (planning.status !== "success" || !planning.data) {
      run = transition(run, "failed", `Planning failed: ${planning.failureReason}`, now());
      return finish(run, artifacts);
    }
    artifacts.plan = planning.data;

    // Deterministic checks first: they are free, objective, and if they fail
    // there is no point paying a judge to read a plan we already know is short.
    run = transition(run, "validation", "Running deterministic checks", now());
    const validation = validatePlan(planning.data, artifacts.requirements);
    artifacts.validation = validation;
    run = recordEvent(
      run,
      validation.passed ? "stage_succeeded" : "stage_failed",
      `${validation.results.length} check(s): ${validation.failedCount} failed, ${validation.warnedCount} warned`,
      now(),
    );

    if (!validation.passed) {
      if (round === maxRepairRounds) {
        run = transition(run, "failed", `Deterministic checks failed after ${round + 1} attempt(s)`, now());
        return finish(run, artifacts);
      }
      priorFeedback = formatFailedChecks(validation);
      continue;
    }

    run = transition(run, "evaluation", "Evaluating plan against rubric", now());
    const evaluation = await evaluatePlan(provider, ticket, artifacts.requirements, planning.data);
    artifacts.stageRuns.push(toRecord("evaluation", round, evaluation));

    if (evaluation.status !== "success" || !evaluation.data) {
      run = transition(run, "failed", `Evaluation failed: ${evaluation.failureReason}`, now());
      return finish(run, artifacts);
    }

    const verdict = scoreEvaluation(evaluation.data);
    artifacts.evaluation = verdict;
    run = recordEvent(
      run,
      verdict.passed ? "stage_succeeded" : "stage_failed",
      `Rubric average ${verdict.averageScore.toFixed(2)} (${verdict.passed ? "pass" : "below threshold"})`,
      now(),
    );

    if (verdict.passed) {
      run = transition(run, "awaiting_approval", "Plan ready for human approval", now());
      return finish(run, artifacts);
    }

    if (round === maxRepairRounds) {
      run = transition(
        run,
        "failed",
        `Plan did not reach the rubric threshold after ${round + 1} attempt(s)`,
        now(),
      );
      return finish(run, artifacts);
    }

    priorFeedback = formatWeakCriteria(verdict);
  }

  // Unreachable: every path inside the loop returns.
  run = transition(run, "failed", "Repair budget exhausted", now());
  return finish(run, artifacts);
}

function formatWeakCriteria(verdict: EvaluationVerdict): string {
  const lines = verdict.weakest.map((s) => `- ${s.criterionId} scored ${s.score}: ${s.evidence}`);
  return [`Rubric average was ${verdict.averageScore.toFixed(2)}.`, ...lines].join("\n");
}

function finish(run: Run, artifacts: RunArtifacts): WorkflowResult {
  return { run, artifacts, totals: summarizeTotals(artifacts.stageRuns) };
}

export type { Evaluation, EvaluationVerdict };
