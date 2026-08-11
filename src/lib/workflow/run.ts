import type { ModelUsage } from "@/lib/llm/types";
import type { Ticket } from "@/lib/ticket/schema";

/**
 * Workflow state, modelled explicitly.
 *
 * Every stage a run can occupy is named here, and every legal move between
 * them is declared in ALLOWED_TRANSITIONS. Encoding this as data rather than
 * scattered booleans means an illegal transition is a caught error rather than
 * a UI that quietly shows the wrong thing.
 */
export type RunStage =
  | "intake"
  | "requirements"
  | "planning"
  | "validation"
  | "evaluation"
  | "awaiting_approval"
  | "complete"
  | "failed";

export const TERMINAL_STAGES: readonly RunStage[] = ["complete", "failed"];

const ALLOWED_TRANSITIONS: Record<RunStage, readonly RunStage[]> = {
  intake: ["requirements", "failed"],
  requirements: ["planning", "failed"],
  planning: ["validation", "failed"],
  // Deterministic checks can send a plan back before a judge ever sees it —
  // there is no point paying to evaluate a plan already known to be short.
  validation: ["evaluation", "planning", "failed"],
  // Evaluation can loop back to planning: that is the repair path for a plan
  // that is well-formed but judged inadequate.
  evaluation: ["awaiting_approval", "planning", "failed"],
  awaiting_approval: ["complete", "planning", "failed"],
  complete: [],
  failed: [],
};

export function canTransition(from: RunStage, to: RunStage): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(stage: RunStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

/** One thing that happened, in order. The run's audit trail. */
export interface RunEvent {
  at: number;
  stage: RunStage;
  kind: "stage_entered" | "stage_succeeded" | "stage_failed" | "note";
  message: string;
}

export interface StageCost {
  usage: ModelUsage;
  latencyMs: number;
  estimatedCostUsd: number | null;
  /** Model calls made, including repair attempts. */
  attempts: number;
}

export const ZERO_STAGE_COST: StageCost = {
  usage: { inputTokens: 0, outputTokens: 0 },
  latencyMs: 0,
  estimatedCostUsd: 0,
  attempts: 0,
};

export type ApprovalDecision = "approved" | "rejected";

export interface Approval {
  decision: ApprovalDecision;
  note: string;
  at: number;
}

export class IllegalTransitionError extends Error {
  constructor(from: RunStage, to: RunStage) {
    super(`Illegal workflow transition: ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

/**
 * A run is a plain data object rather than a class with behaviour, so it can
 * be serialised into a recording, sent to the client, or diffed in a test
 * without ceremony. Transitions are pure functions over it.
 */
export interface Run {
  id: string;
  ticket: Ticket;
  stage: RunStage;
  createdAt: number;
  updatedAt: number;
  events: RunEvent[];
  /** How many times the plan has been regenerated after a failed evaluation. */
  repairRounds: number;
  approval: Approval | null;
  failureReason: string | null;
}

export const MAX_REPAIR_ROUNDS = 2;

export function createRun(id: string, ticket: Ticket, now = Date.now()): Run {
  return {
    id,
    ticket,
    stage: "intake",
    createdAt: now,
    updatedAt: now,
    events: [
      { at: now, stage: "intake", kind: "stage_entered", message: "Run created from ticket" },
    ],
    repairRounds: 0,
    approval: null,
    failureReason: null,
  };
}

/**
 * Moves a run to a new stage, rejecting transitions the state machine does not
 * allow. Returns a new object rather than mutating, so React state updates and
 * event sourcing both behave.
 */
export function transition(
  run: Run,
  to: RunStage,
  message: string,
  now = Date.now(),
): Run {
  if (!canTransition(run.stage, to)) {
    throw new IllegalTransitionError(run.stage, to);
  }

  // Entering planning from requirements is the first pass. Arriving from any
  // later stage means something sent it back, which is a repair round.
  const isRepair = to === "planning" && run.stage !== "requirements";

  return {
    ...run,
    stage: to,
    updatedAt: now,
    repairRounds: isRepair ? run.repairRounds + 1 : run.repairRounds,
    failureReason: to === "failed" ? message : run.failureReason,
    events: [
      ...run.events,
      { at: now, stage: to, kind: to === "failed" ? "stage_failed" : "stage_entered", message },
    ],
  };
}

export function recordEvent(
  run: Run,
  kind: RunEvent["kind"],
  message: string,
  now = Date.now(),
): Run {
  return {
    ...run,
    updatedAt: now,
    events: [...run.events, { at: now, stage: run.stage, kind, message }],
  };
}

export function recordApproval(
  run: Run,
  decision: ApprovalDecision,
  note: string,
  now = Date.now(),
): Run {
  const withApproval: Run = {
    ...run,
    approval: { decision, note, at: now },
  };
  return transition(
    withApproval,
    decision === "approved" ? "complete" : "planning",
    decision === "approved" ? `Approved: ${note || "no note"}` : `Rejected: ${note || "no note"}`,
    now,
  );
}

/** True when another repair round would exceed the bound. */
export function repairBudgetExhausted(run: Run): boolean {
  return run.repairRounds >= MAX_REPAIR_ROUNDS;
}
