/**
 * The rubric for model-based plan evaluation.
 *
 * Every criterion here requires judgement. Anything objectively decidable —
 * requirement coverage, presence of a test strategy, unmitigated risks —
 * belongs in the deterministic checks instead, and is deliberately absent.
 *
 * Scores are 1–5 with stated meanings, because an unanchored 1–10 scale
 * produces numbers no two runs agree on.
 */

export interface RubricCriterion {
  id: string;
  label: string;
  question: string;
  /** What separates a top score from a failing one. */
  anchors: string;
}

export const PLAN_RUBRIC: RubricCriterion[] = [
  {
    id: "approach_soundness",
    label: "Approach soundness",
    question: "Is the proposed approach a reasonable way to satisfy the requirements?",
    anchors:
      "5 = the approach is what an experienced engineer would choose. 3 = workable but with an avoidable flaw. 1 = would not produce a working result.",
  },
  {
    id: "unsupported_assumptions",
    label: "Unsupported assumptions",
    question:
      "Does the plan invent constraints, behaviour, or context the ticket and requirements never established?",
    anchors:
      "5 = every claim traces to the ticket or is flagged as an assumption. 3 = one minor unflagged assumption. 1 = substantive invented requirements.",
  },
  {
    id: "test_strategy_quality",
    label: "Test strategy quality",
    question:
      "Would the stated tests actually catch a regression in the behaviour being changed?",
    anchors:
      "5 = tests target the specific behaviour and its failure modes. 3 = generic tests that would catch only gross breakage. 1 = tests that would pass regardless of correctness.",
  },
  {
    id: "scope_discipline",
    label: "Scope discipline",
    question: "Does the plan stay within what was asked?",
    anchors:
      "5 = does exactly what the ticket requires. 3 = minor unrequested additions. 1 = substantial unrequested rework.",
  },
  {
    id: "risk_awareness",
    label: "Risk awareness",
    question:
      "Does the plan identify the risks that actually matter for this change, including security and accessibility where relevant?",
    anchors:
      "5 = names the genuine risks with useful mitigations. 3 = generic risks only. 1 = misses an obvious serious risk.",
  },
];

/** A plan must clear this average to advance without a repair round. */
export const PASSING_THRESHOLD = 3.5;

/**
 * Known limitations of this evaluator, stated rather than discovered later:
 *
 * - It judges the plan, not the eventual implementation. A good plan can still
 *   be implemented badly.
 * - The judge shares a model family with the planner, so it is more likely to
 *   accept reasoning it would itself have produced.
 * - Scores are not calibrated against human raters; the threshold is a
 *   starting point, not a validated cutoff.
 * - It sees no repository context, so it cannot know whether a proposed file
 *   path or module actually exists.
 */
export const EVALUATOR_LIMITATIONS = [
  "Judges the plan, not the eventual implementation.",
  "Shares a model family with the planner, so it may accept its own style of reasoning too readily.",
  "Thresholds are not calibrated against human raters.",
  "Has no repository context, so it cannot verify that referenced files exist.",
] as const;
