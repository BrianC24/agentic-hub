import type { ImplementationPlan } from "@/lib/planning/schema";
import type { ExtractedRequirements } from "@/lib/requirements/schema";

/**
 * Deterministic checks over a plan.
 *
 * Everything here is objectively decidable, so none of it is delegated to a
 * model. An LLM judge that re-answered these questions would be slower, more
 * expensive, and occasionally wrong about facts that are simply computable.
 * The model-based evaluator runs only on what is left over.
 */

export type CheckStatus = "pass" | "fail" | "warn";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  /** What was actually observed, shown in the run report, not just pass/fail. */
  detail: string;
}

export interface ValidationReport {
  results: CheckResult[];
  passed: boolean;
  failedCount: number;
  warnedCount: number;
}

/**
 * Every explicit requirement must be claimed by at least one step.
 *
 * This is the check that most justifies the plan schema carrying requirement
 * ids: coverage becomes set arithmetic instead of an opinion.
 */
function checkRequirementCoverage(
  plan: ImplementationPlan,
  requirements: ExtractedRequirements,
): CheckResult {
  const claimed = new Set(plan.steps.flatMap((step) => step.addressesRequirements));
  const explicit = requirements.explicitRequirements;
  const uncovered = explicit.filter((r) => !claimed.has(r.id));

  if (explicit.length === 0) {
    return {
      id: "requirement-coverage",
      label: "Every explicit requirement is addressed",
      status: "warn",
      detail: "No explicit requirements were extracted, so coverage is vacuous.",
    };
  }

  return {
    id: "requirement-coverage",
    label: "Every explicit requirement is addressed",
    status: uncovered.length === 0 ? "pass" : "fail",
    detail:
      uncovered.length === 0
        ? `All ${explicit.length} explicit requirement(s) claimed by at least one step.`
        : `Uncovered: ${uncovered.map((r) => `${r.id} (${r.text})`).join("; ")}`,
  };
}

function checkTestStrategy(plan: ImplementationPlan): CheckResult {
  const count = plan.testStrategy.length;
  return {
    id: "test-strategy",
    label: "Plan states how the change will be verified",
    status: count > 0 ? "pass" : "fail",
    detail: count > 0 ? `${count} test-strategy item(s).` : "No test strategy provided.",
  };
}

function checkStepsPresent(plan: ImplementationPlan): CheckResult {
  return {
    id: "steps-present",
    label: "Plan contains at least one step",
    status: plan.steps.length > 0 ? "pass" : "fail",
    detail: `${plan.steps.length} step(s).`,
  };
}

/** A step claiming no requirements may be scope creep, so it is worth flagging without failing. */
function checkNoOrphanSteps(plan: ImplementationPlan): CheckResult {
  const orphans = plan.steps.filter((s) => s.addressesRequirements.length === 0);
  return {
    id: "orphan-steps",
    label: "Steps trace back to a requirement",
    status: orphans.length === 0 ? "pass" : "warn",
    detail:
      orphans.length === 0
        ? "Every step cites at least one requirement."
        : `Not traced to any requirement: ${orphans.map((s) => s.id).join(", ")}`,
  };
}

/** Ambiguities the extraction stage raised should surface as risks in the plan. */
function checkAmbiguitiesAcknowledged(
  plan: ImplementationPlan,
  requirements: ExtractedRequirements,
): CheckResult {
  const ambiguityCount = requirements.ambiguities.length;
  if (ambiguityCount === 0) {
    return {
      id: "ambiguities-acknowledged",
      label: "Open ambiguities are carried into the plan",
      status: "pass",
      detail: "No ambiguities were raised.",
    };
  }

  const hasRisks = plan.risks.length > 0;
  return {
    id: "ambiguities-acknowledged",
    label: "Open ambiguities are carried into the plan",
    status: hasRisks ? "pass" : "warn",
    detail: hasRisks
      ? `${ambiguityCount} ambiguity(ies) raised; plan lists ${plan.risks.length} risk(s).`
      : `${ambiguityCount} ambiguity(ies) raised but the plan lists no risks.`,
  };
}

/** Every risk needs a mitigation, because a risk list with none is decoration. */
function checkRisksMitigated(plan: ImplementationPlan): CheckResult {
  const unmitigated = plan.risks.filter((r) => r.mitigation.trim().length === 0);
  return {
    id: "risks-mitigated",
    label: "Each risk has a mitigation",
    status: unmitigated.length === 0 ? "pass" : "fail",
    detail:
      unmitigated.length === 0
        ? `${plan.risks.length} risk(s), all mitigated.`
        : `${unmitigated.length} risk(s) with no mitigation.`,
  };
}

export function validatePlan(
  plan: ImplementationPlan,
  requirements: ExtractedRequirements,
): ValidationReport {
  const results = [
    checkStepsPresent(plan),
    checkRequirementCoverage(plan, requirements),
    checkTestStrategy(plan),
    checkNoOrphanSteps(plan),
    checkAmbiguitiesAcknowledged(plan, requirements),
    checkRisksMitigated(plan),
  ];

  const failedCount = results.filter((r) => r.status === "fail").length;
  const warnedCount = results.filter((r) => r.status === "warn").length;

  return {
    results,
    // Warnings do not block. They are judgement calls surfaced to the human,
    // not objective failures.
    passed: failedCount === 0,
    failedCount,
    warnedCount,
  };
}

/** Compact summary for a repair prompt. */
export function formatFailedChecks(report: ValidationReport): string {
  return report.results
    .filter((r) => r.status === "fail")
    .map((r) => `- ${r.label}: ${r.detail}`)
    .join("\n");
}
