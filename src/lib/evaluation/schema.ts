import { z } from "zod";
import type { SchemaViolation, StructuredParseResult } from "@/lib/llm/structured";
import { PASSING_THRESHOLD, PLAN_RUBRIC } from "./rubric";
import { stripCodeFence } from "@/lib/llm/json";

/**
 * Contract for a rubric evaluation.
 *
 * Each criterion carries a score *and* written evidence, because a bare number
 * is unreviewable — a human cannot tell a considered 4 from a lazy one.
 */

export const CriterionScoreSchema = z.object({
  criterionId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  /** Must quote or cite the part of the plan being judged. */
  evidence: z.string().min(1, "Evidence is required for every score"),
});

export const EvaluationSchema = z.object({
  scores: z.array(CriterionScoreSchema),
  overallComment: z.string().min(1),
});

export type CriterionScore = z.infer<typeof CriterionScoreSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;

export type EvaluationParseResult = StructuredParseResult<Evaluation>;

/** Scored evaluation plus the derived verdict. */
export interface EvaluationVerdict {
  evaluation: Evaluation;
  averageScore: number;
  passed: boolean;
  /** Criteria scoring below the threshold, for the repair prompt. */
  weakest: CriterionScore[];
}

/**
 * The judge must score every rubric criterion exactly once.
 *
 * Without this, a model can quietly skip the criterion it would score badly,
 * and the average silently improves. Same failure class as fabricated quotes:
 * structurally valid, semantically dishonest.
 */
function findCoverageViolations(evaluation: Evaluation): SchemaViolation[] {
  const violations: SchemaViolation[] = [];
  const seen = new Map<string, number>();

  for (const score of evaluation.scores) {
    seen.set(score.criterionId, (seen.get(score.criterionId) ?? 0) + 1);
  }

  for (const criterion of PLAN_RUBRIC) {
    const count = seen.get(criterion.id) ?? 0;
    if (count === 0) {
      violations.push({
        path: "scores",
        message: `Missing a score for rubric criterion "${criterion.id}"`,
      });
    } else if (count > 1) {
      violations.push({
        path: "scores",
        message: `Criterion "${criterion.id}" was scored ${count} times; score it exactly once`,
      });
    }
  }

  const known = new Set(PLAN_RUBRIC.map((c) => c.id));
  for (const score of evaluation.scores) {
    if (!known.has(score.criterionId)) {
      violations.push({
        path: "scores",
        message: `"${score.criterionId}" is not a rubric criterion. Valid ids: ${[...known].join(", ")}`,
      });
    }
  }

  return violations;
}

export function parseEvaluation(raw: string): EvaluationParseResult {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(raw));
  } catch {
    return {
      success: false,
      violations: [{ path: "(root)", message: "Response was not valid JSON" }],
    };
  }

  const result = EvaluationSchema.safeParse(json);
  if (!result.success) {
    return {
      success: false,
      violations: result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }

  const coverage = findCoverageViolations(result.data);
  if (coverage.length > 0) {
    return { success: false, violations: coverage };
  }

  return { success: true, data: result.data };
}

export function scoreEvaluation(evaluation: Evaluation): EvaluationVerdict {
  const total = evaluation.scores.reduce((sum, s) => sum + s.score, 0);
  const averageScore = evaluation.scores.length > 0 ? total / evaluation.scores.length : 0;

  return {
    evaluation,
    averageScore,
    passed: averageScore >= PASSING_THRESHOLD,
    weakest: evaluation.scores
      .filter((s) => s.score < Math.ceil(PASSING_THRESHOLD))
      .sort((a, b) => a.score - b.score),
  };
}

