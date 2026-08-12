import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/llm/mock-provider";
import { PLAN_RUBRIC } from "@/lib/evaluation/rubric";
import { TICKET_FIXTURES } from "@/lib/ticket/fixtures";
import { runWorkflow, type WorkflowResult } from "./orchestrator";
import { approveRun, replanAfterRejection } from "./replan";

const ticket = TICKET_FIXTURES[0].ticket;

const requirementsJson = JSON.stringify({
  summary: "Add CSV export.",
  explicitRequirements: [
    { id: "R1", text: "Export as CSV", sourceQuote: "export a board's activity log to CSV" },
  ],
  impliedRequirements: [],
  ambiguities: [],
  missingInformation: [],
  clarificationNeeded: false,
});

function planJson(approach = "Add an export endpoint.") {
  return JSON.stringify({
    approach,
    steps: [{ id: "S1", description: "Add endpoint", addressesRequirements: ["R1"], files: ["api.ts"] }],
    testStrategy: ["Unit test the serializer"],
    risks: [{ description: "Timeouts", mitigation: "Stream" }],
    outOfScope: [],
  });
}

function evaluationJson(score: number) {
  return JSON.stringify({
    scores: PLAN_RUBRIC.map((c) => ({ criterionId: c.id, score, evidence: "S1 covers R1." })),
    overallComment: "Assessed.",
  });
}

async function runToApproval(): Promise<WorkflowResult> {
  const provider = new MockProvider({
    model: "claude-haiku-4-5",
    turns: [{ text: requirementsJson }, { text: planJson() }, { text: evaluationJson(5) }],
  });
  return runWorkflow(provider, ticket);
}

describe("approveRun", () => {
  it("completes the run and records the note", async () => {
    const result = await runToApproval();
    const approved = approveRun(result.run, "ship it");

    expect(approved.stage).toBe("complete");
    expect(approved.approval).toEqual(
      expect.objectContaining({ decision: "approved", note: "ship it" }),
    );
  });
});

describe("replanAfterRejection", () => {
  it("produces a new plan using the reviewer's note as the instruction", async () => {
    const result = await runToApproval();
    const provider = new MockProvider({
      model: "claude-haiku-4-5",
      turns: [{ text: planJson("Add a streaming export endpoint with rollback.") }, { text: evaluationJson(5) }],
    });

    const replanned = await replanAfterRejection({
      provider,
      ticket,
      run: result.run,
      artifacts: result.artifacts,
      note: "No rollback step.",
    });

    expect(replanned.run.stage).toBe("awaiting_approval");
    expect(replanned.artifacts.plan?.approach).toContain("rollback");
    // The human's words must reach the model, or rejection is just a veto.
    expect(provider.requests[0].messages[0].content).toContain("No rollback step.");
    expect(provider.requests[0].messages[0].content).toMatch(/reviewer rejected/i);
  });

  it("records the rejection and counts it as a repair round", async () => {
    const result = await runToApproval();
    const provider = new MockProvider({
      model: "claude-haiku-4-5",
      turns: [{ text: planJson() }, { text: evaluationJson(5) }],
    });

    const replanned = await replanAfterRejection({
      provider,
      ticket,
      run: result.run,
      artifacts: result.artifacts,
      note: "Too vague",
    });

    expect(replanned.run.approval?.decision).toBe("rejected");
    expect(replanned.run.repairRounds).toBe(1);
  });

  it("still asks for a different plan when no reason is given", async () => {
    const result = await runToApproval();
    const provider = new MockProvider({
      model: "claude-haiku-4-5",
      turns: [{ text: planJson() }, { text: evaluationJson(5) }],
    });

    await replanAfterRejection({
      provider,
      ticket,
      run: result.run,
      artifacts: result.artifacts,
      note: "",
    });

    expect(provider.requests[0].messages[0].content).toMatch(/materially different/i);
  });

  it("fails once too many plans have been rejected", async () => {
    let result = await runToApproval();

    // Burn the repair budget with successive rejections.
    for (let i = 0; i < 2; i += 1) {
      const provider = new MockProvider({
        model: "claude-haiku-4-5",
        turns: [{ text: planJson() }, { text: evaluationJson(5) }],
      });
      result = await replanAfterRejection({
        provider,
        ticket,
        run: result.run,
        artifacts: result.artifacts,
        note: `rejection ${i}`,
      });
    }

    const provider = new MockProvider({ model: "claude-haiku-4-5", turns: [] });
    const exhausted = await replanAfterRejection({
      provider,
      ticket,
      run: result.run,
      artifacts: result.artifacts,
      note: "again",
    });

    expect(exhausted.run.stage).toBe("failed");
    expect(exhausted.run.failureReason).toMatch(/budget exhausted/i);
    // No model call should be made once the budget is gone.
    expect(provider.calls).toBe(0);
  });

  it("carries the earlier stage runs into the new trace", async () => {
    const result = await runToApproval();
    const before = result.artifacts.stageRuns.length;

    const provider = new MockProvider({
      model: "claude-haiku-4-5",
      turns: [{ text: planJson() }, { text: evaluationJson(5) }],
    });
    const replanned = await replanAfterRejection({
      provider,
      ticket,
      run: result.run,
      artifacts: result.artifacts,
      note: "redo",
    });

    // The report must show the whole history, not just the latest round.
    expect(replanned.artifacts.stageRuns.length).toBe(before + 2);
    expect(replanned.totals.modelCalls).toBeGreaterThan(result.totals.modelCalls);
  });
});
