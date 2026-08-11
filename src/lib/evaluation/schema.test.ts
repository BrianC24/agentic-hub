import { describe, expect, it } from "vitest";
import { parseEvaluation, scoreEvaluation } from "./schema";
import { PASSING_THRESHOLD, PLAN_RUBRIC } from "./rubric";

function evaluationWith(scores: Array<{ criterionId: string; score: number }>) {
  return JSON.stringify({
    scores: scores.map((s) => ({ ...s, evidence: "Step S1 does the thing." })),
    overallComment: "Reasonable plan overall.",
  });
}

const allCriteria = PLAN_RUBRIC.map((c) => c.id);

describe("parseEvaluation", () => {
  it("accepts a complete scoring", () => {
    const raw = evaluationWith(allCriteria.map((id) => ({ criterionId: id, score: 4 })));
    expect(parseEvaluation(raw).success).toBe(true);
  });

  it("rejects a scoring that skips a criterion", () => {
    // The failure mode that matters: quietly omitting the criterion you would
    // score badly, which silently raises the average.
    const raw = evaluationWith(allCriteria.slice(1).map((id) => ({ criterionId: id, score: 5 })));
    const result = parseEvaluation(raw);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.violations[0].message).toMatch(/missing a score/i);
      expect(result.violations[0].message).toContain(allCriteria[0]);
    }
  });

  it("rejects a criterion scored twice", () => {
    const raw = evaluationWith([
      ...allCriteria.map((id) => ({ criterionId: id, score: 4 })),
      { criterionId: allCriteria[0], score: 5 },
    ]);
    const result = parseEvaluation(raw);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.violations.some((v) => /scored 2 times/.test(v.message))).toBe(true);
    }
  });

  it("rejects an invented criterion id", () => {
    const raw = evaluationWith([
      ...allCriteria.map((id) => ({ criterionId: id, score: 4 })),
      { criterionId: "vibes", score: 5 },
    ]);
    const result = parseEvaluation(raw);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.violations.some((v) => v.message.includes("vibes"))).toBe(true);
    }
  });

  it("rejects a score outside 1-5", () => {
    const raw = evaluationWith(allCriteria.map((id) => ({ criterionId: id, score: 9 })));
    expect(parseEvaluation(raw).success).toBe(false);
  });

  it("requires evidence for every score", () => {
    const raw = JSON.stringify({
      scores: allCriteria.map((id) => ({ criterionId: id, score: 4, evidence: "" })),
      overallComment: "fine",
    });
    const result = parseEvaluation(raw);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.violations.some((v) => /evidence/i.test(v.message))).toBe(true);
    }
  });
});

describe("scoreEvaluation", () => {
  it("passes a plan at or above the threshold", () => {
    const raw = evaluationWith(allCriteria.map((id) => ({ criterionId: id, score: 4 })));
    const parsed = parseEvaluation(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const verdict = scoreEvaluation(parsed.data);
    expect(verdict.averageScore).toBe(4);
    expect(verdict.passed).toBe(true);
  });

  it("fails a plan below the threshold and surfaces the weakest criteria", () => {
    const raw = evaluationWith(allCriteria.map((id, i) => ({ criterionId: id, score: i === 0 ? 1 : 3 })));
    const parsed = parseEvaluation(raw);
    if (!parsed.success) throw new Error("fixture should parse");

    const verdict = scoreEvaluation(parsed.data);
    expect(verdict.averageScore).toBeLessThan(PASSING_THRESHOLD);
    expect(verdict.passed).toBe(false);
    expect(verdict.weakest[0].score).toBe(1);
  });
});
