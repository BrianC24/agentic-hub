import { describe, expect, it } from "vitest";
import { MockProvider, type MockTurn } from "@/lib/llm/mock-provider";
import { ModelProviderError } from "@/lib/llm/types";
import { PLAN_RUBRIC } from "@/lib/evaluation/rubric";
import { TICKET_FIXTURES } from "@/lib/ticket/fixtures";
import { runWorkflow } from "./orchestrator";

const ticket = TICKET_FIXTURES[0].ticket;

const requirementsJson = JSON.stringify({
  summary: "Add CSV export to the activity log.",
  explicitRequirements: [
    {
      id: "R1",
      text: "Export the activity log as CSV",
      sourceQuote: "export a board's activity log to CSV",
    },
  ],
  impliedRequirements: [{ id: "I1", text: "Escape commas" }],
  ambiguities: [{ question: "Timezone?", why: "Changes output" }],
  missingInformation: [],
  clarificationNeeded: false,
});

function planJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    approach: "Add an export endpoint and a toolbar button.",
    steps: [
      { id: "S1", description: "Add export endpoint", addressesRequirements: ["R1"], files: ["api.ts"] },
    ],
    testStrategy: ["Unit test the CSV serializer"],
    risks: [{ description: "Large exports time out", mitigation: "Stream the response" }],
    outOfScope: [],
    ...overrides,
  });
}

function evaluationJson(score: number) {
  return JSON.stringify({
    scores: PLAN_RUBRIC.map((c) => ({
      criterionId: c.id,
      score,
      evidence: "Step S1 addresses the export requirement.",
    })),
    overallComment: "Assessed against the rubric.",
  });
}

function provider(turns: MockTurn[]) {
  return new MockProvider({ model: "claude-haiku-4-5", turns });
}

describe("runWorkflow", () => {
  it("carries a good ticket through to the approval gate", async () => {
    const p = provider([
      { text: requirementsJson },
      { text: planJson() },
      { text: evaluationJson(5) },
    ]);

    const result = await runWorkflow(p, ticket);

    expect(result.run.stage).toBe("awaiting_approval");
    expect(result.artifacts.requirements?.explicitRequirements).toHaveLength(1);
    expect(result.artifacts.plan?.steps).toHaveLength(1);
    expect(result.artifacts.validation?.passed).toBe(true);
    expect(result.artifacts.evaluation?.passed).toBe(true);
    expect(result.totals.modelCalls).toBe(3);
  });

  it("stops at approval rather than completing itself", async () => {
    const p = provider([
      { text: requirementsJson },
      { text: planJson() },
      { text: evaluationJson(5) },
    ]);

    const result = await runWorkflow(p, ticket);

    // Approval is a human decision — the workflow must not self-approve.
    expect(result.run.stage).not.toBe("complete");
    expect(result.run.approval).toBeNull();
  });

  it("replans when deterministic checks fail, without paying for evaluation", async () => {
    const p = provider([
      { text: requirementsJson },
      // Schema-valid, but covers only the implied requirement — so explicit
      // requirement R1 is uncovered and the coverage check fails. An empty
      // testStrategy would not test this path: the schema rejects that first,
      // inside the planning stage's own repair loop.
      {
        text: planJson({
          steps: [
            { id: "S1", description: "Escape commas", addressesRequirements: ["I1"], files: ["csv.ts"] },
          ],
        }),
      },
      { text: planJson() },
      { text: evaluationJson(4) },
    ]);

    const result = await runWorkflow(p, ticket);

    expect(result.run.stage).toBe("awaiting_approval");
    expect(result.run.repairRounds).toBe(1);
    // 2 planning + 1 evaluation: the rejected plan never reached the judge.
    expect(p.calls).toBe(4);
    const evaluations = result.artifacts.stageRuns.filter((r) => r.stage === "evaluation");
    expect(evaluations).toHaveLength(1);
  });

  it("replans when the rubric score is below threshold", async () => {
    const p = provider([
      { text: requirementsJson },
      { text: planJson() },
      { text: evaluationJson(2) },
      { text: planJson() },
      { text: evaluationJson(5) },
    ]);

    const result = await runWorkflow(p, ticket);

    expect(result.run.stage).toBe("awaiting_approval");
    expect(result.run.repairRounds).toBe(1);
    expect(result.artifacts.evaluation?.averageScore).toBe(5);
  });

  it("feeds the weak criteria back into the replan prompt", async () => {
    const p = provider([
      { text: requirementsJson },
      { text: planJson() },
      { text: evaluationJson(2) },
      { text: planJson() },
      { text: evaluationJson(5) },
    ]);

    await runWorkflow(p, ticket);

    // 4th call is the replan; it must carry the rubric feedback.
    const replanPrompt = p.requests[3].messages[0].content;
    expect(replanPrompt).toMatch(/rejected for these reasons/i);
    expect(replanPrompt).toMatch(/scored 2/);
  });

  it("fails once the repair budget is exhausted", async () => {
    const p = provider([
      { text: requirementsJson },
      { text: planJson() },
      { text: evaluationJson(1) },
      { text: planJson() },
      { text: evaluationJson(1) },
      { text: planJson() },
      { text: evaluationJson(1) },
    ]);

    const result = await runWorkflow(p, ticket, { maxRepairRounds: 2 });

    expect(result.run.stage).toBe("failed");
    expect(result.run.failureReason).toMatch(/rubric threshold/i);
    expect(result.run.repairRounds).toBe(2);
  });

  it("fails fast when requirement extraction cannot succeed", async () => {
    const p = provider([
      { error: new ModelProviderError("401 unauthorized", { retryable: false }) },
    ]);

    const result = await runWorkflow(p, ticket);

    expect(result.run.stage).toBe("failed");
    expect(result.run.failureReason).toMatch(/extraction failed/i);
    expect(result.artifacts.plan).toBeNull();
    expect(p.calls).toBe(1);
  });

  it("aggregates tokens, latency, and cost across every stage", async () => {
    const p = provider([
      { text: requirementsJson, usage: { inputTokens: 100, outputTokens: 200 } },
      { text: planJson(), usage: { inputTokens: 300, outputTokens: 400 } },
      { text: evaluationJson(5), usage: { inputTokens: 50, outputTokens: 60 } },
    ]);

    const result = await runWorkflow(p, ticket);

    expect(result.totals.usage).toEqual({ inputTokens: 450, outputTokens: 660 });
    expect(result.totals.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("records an ordered event trail for the run report", async () => {
    const p = provider([
      { text: requirementsJson },
      { text: planJson() },
      { text: evaluationJson(5) },
    ]);

    const result = await runWorkflow(p, ticket);
    const stages = result.run.events.map((e) => e.stage);

    expect(stages[0]).toBe("intake");
    expect(stages).toContain("requirements");
    expect(stages).toContain("planning");
    expect(stages).toContain("validation");
    expect(stages).toContain("evaluation");
    expect(stages.at(-1)).toBe("awaiting_approval");
  });
});
