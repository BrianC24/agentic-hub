import { describe, expect, it } from "vitest";
import { TICKET_FIXTURES } from "@/lib/ticket/fixtures";
import {
  canTransition,
  createRun,
  IllegalTransitionError,
  isTerminal,
  MAX_REPAIR_ROUNDS,
  recordApproval,
  repairBudgetExhausted,
  transition,
  type Run,
} from "./run";

const ticket = TICKET_FIXTURES[0].ticket;

function advanceTo(stage: Run["stage"]): Run {
  let run = createRun("r1", ticket, 0);
  const path: Run["stage"][] = [
    "requirements",
    "planning",
    "validation",
    "evaluation",
    "awaiting_approval",
  ];
  for (const next of path) {
    run = transition(run, next, `-> ${next}`, 0);
    if (next === stage) return run;
  }
  return run;
}

describe("workflow state machine", () => {
  it("starts a run at intake", () => {
    const run = createRun("r1", ticket, 0);
    expect(run.stage).toBe("intake");
    expect(run.events).toHaveLength(1);
  });

  it("allows the happy path through to completion", () => {
    let run = advanceTo("awaiting_approval");
    run = recordApproval(run, "approved", "looks right", 0);
    expect(run.stage).toBe("complete");
    expect(run.approval?.decision).toBe("approved");
  });

  it("rejects a transition that skips a stage", () => {
    const run = createRun("r1", ticket, 0);
    expect(() => transition(run, "evaluation", "skip ahead", 0)).toThrow(IllegalTransitionError);
  });

  it("rejects any transition out of a terminal stage", () => {
    let run = advanceTo("awaiting_approval");
    run = recordApproval(run, "approved", "", 0);
    expect(() => transition(run, "planning", "reopen", 0)).toThrow(IllegalTransitionError);
  });

  it("treats rejection as a loop back to planning, not a failure", () => {
    let run = advanceTo("awaiting_approval");
    run = recordApproval(run, "rejected", "missing rollback plan", 0);
    expect(run.stage).toBe("planning");
    expect(run.approval?.decision).toBe("rejected");
  });

  it("counts a loop back to planning as a repair round", () => {
    let run = advanceTo("evaluation");
    expect(run.repairRounds).toBe(0);
    run = transition(run, "planning", "eval failed", 0);
    expect(run.repairRounds).toBe(1);
  });

  it("does not count the first entry into planning as a repair", () => {
    const run = advanceTo("planning");
    expect(run.repairRounds).toBe(0);
  });

  it("reports the repair budget as exhausted at the bound", () => {
    let run = advanceTo("evaluation");
    for (let i = 0; i < MAX_REPAIR_ROUNDS; i += 1) {
      run = transition(run, "planning", "retry", 0);
      run = transition(run, "validation", "-> validation", 0);
      run = transition(run, "evaluation", "-> evaluation", 0);
    }
    expect(repairBudgetExhausted(run)).toBe(true);
  });

  it("records a failure reason when failing", () => {
    let run = createRun("r1", ticket, 0);
    run = transition(run, "failed", "provider unreachable", 0);
    expect(run.stage).toBe("failed");
    expect(run.failureReason).toBe("provider unreachable");
    expect(isTerminal(run.stage)).toBe(true);
  });

  it("never mutates the run it was given", () => {
    const run = createRun("r1", ticket, 0);
    const next = transition(run, "requirements", "-> requirements", 0);
    expect(run.stage).toBe("intake");
    expect(next).not.toBe(run);
  });

  it("permits failure from every non-terminal stage", () => {
    const stages: Run["stage"][] = [
      "intake",
      "requirements",
      "planning",
      "validation",
      "evaluation",
      "awaiting_approval",
    ];
    for (const stage of stages) {
      expect(canTransition(stage, "failed")).toBe(true);
    }
  });
});
