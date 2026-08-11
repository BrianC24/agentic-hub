import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/llm/mock-provider";
import { createReplayProvider, hasRecording } from "@/lib/replay";
import { EVAL_CASES } from "./cases";
import { formatEvalReport, runEvals } from "./runner";

/**
 * Free regression gate.
 *
 * Cases with a recording are replayed against real captured output, so a
 * change that breaks the pipeline fails here rather than at the next paid
 * eval run.
 */
const RECORDED_CASES = EVAL_CASES.filter((c) => hasRecording(c.key));

describe("eval suite over recordings", () => {
  it("covers the recorded cases", () => {
    expect(RECORDED_CASES.length).toBeGreaterThanOrEqual(3);
  });

  it("passes every assertion on the recorded cases", async () => {
    const report = await runEvals((c) => createReplayProvider(c.key), RECORDED_CASES);

    const failures = report.results
      .filter((r) => !r.passed)
      .map((r) => `${r.key}: ${r.assertions.filter((a) => !a.passed).map((a) => a.id).join(", ")}`);

    expect(failures).toEqual([]);
    expect(report.passRate).toBe(1);
  });

  it("reports real cost and latency from the recordings", async () => {
    const report = await runEvals((c) => createReplayProvider(c.key), RECORDED_CASES);
    expect(report.totalCostUsd).toBeGreaterThan(0);
    expect(report.totalModelCalls).toBeGreaterThanOrEqual(RECORDED_CASES.length * 3);
  });
});

describe("runEvals failure handling", () => {
  it("records a provider failure as a failed run, not a crash", async () => {
    // The orchestrator converts provider errors into a failed run rather than
    // letting them escape, so the suite sees a result — not an exception.
    const report = await runEvals(
      () => new MockProvider({ turns: [] }),
      EVAL_CASES.slice(0, 2),
    );

    expect(report.results).toHaveLength(2);
    expect(report.passedCases).toBe(0);
    expect(report.results[0].finalStage).toBe("failed");
    expect(report.results[0].error).toBeNull();
  });

  it("marks every assertion failed on a case that never produced output", async () => {
    const report = await runEvals(() => new MockProvider({ turns: [] }), EVAL_CASES.slice(0, 1));
    expect(report.results[0].assertions.every((a) => !a.passed)).toBe(true);
  });

  it("survives a provider that cannot even be constructed", async () => {
    // e.g. a missing API key. One broken case must not abort the suite.
    const report = await runEvals(() => {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }, EVAL_CASES.slice(0, 2));

    expect(report.results).toHaveLength(2);
    expect(report.results[0].finalStage).toBe("crashed");
    expect(report.results[0].error).toMatch(/API_KEY/);
  });

  it("formats a report a human can read", async () => {
    const report = await runEvals((c) => createReplayProvider(c.key), RECORDED_CASES.slice(0, 1));
    const text = formatEvalReport(report);

    expect(text).toMatch(/PASS|FAIL/);
    expect(text).toMatch(/cases passed/);
  });
});
