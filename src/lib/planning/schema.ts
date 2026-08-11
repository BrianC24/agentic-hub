import { z } from "zod";
import type { SchemaViolation, StructuredParseResult } from "@/lib/llm/structured";
import type { ExtractedRequirements } from "@/lib/requirements/schema";

/**
 * Contract for an implementation plan.
 *
 * Steps carry the requirement ids they satisfy, which is what makes coverage
 * checkable deterministically rather than by asking a model whether the plan
 * "looks complete".
 */

export const PlanStepSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  /** Requirement ids from the extraction stage that this step addresses. */
  addressesRequirements: z.array(z.string().min(1)),
  /** Files expected to change. May be empty for non-code steps. */
  files: z.array(z.string().min(1)),
});

export const RiskSchema = z.object({
  description: z.string().min(1),
  mitigation: z.string().min(1),
});

export const ImplementationPlanSchema = z.object({
  approach: z.string().min(1, "Approach is required"),
  steps: z.array(PlanStepSchema).min(1, "A plan needs at least one step"),
  testStrategy: z.array(z.string().min(1)).min(1, "A plan needs a test strategy"),
  risks: z.array(RiskSchema),
  outOfScope: z.array(z.string().min(1)),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type ImplementationPlan = z.infer<typeof ImplementationPlanSchema>;

export type PlanParseResult = StructuredParseResult<ImplementationPlan>;

/**
 * Semantic rule: a step may only claim requirement ids that actually exist.
 *
 * Without this, a model can satisfy coverage checks by inventing ids — the
 * plan looks complete and is not. Same class of failure as a fabricated quote.
 */
function findUnknownRequirementIds(
  plan: ImplementationPlan,
  requirements: ExtractedRequirements,
): SchemaViolation[] {
  const known = new Set([
    ...requirements.explicitRequirements.map((r) => r.id),
    ...requirements.impliedRequirements.map((r) => r.id),
  ]);

  const violations: SchemaViolation[] = [];
  plan.steps.forEach((step, index) => {
    for (const id of step.addressesRequirements) {
      if (!known.has(id)) {
        violations.push({
          path: `steps.${index}.addressesRequirements`,
          message: `"${id}" is not a requirement id from this ticket. Known ids: ${[...known].join(", ") || "(none)"}`,
        });
      }
    }
  });
  return violations;
}

export function parsePlan(
  raw: string,
  requirements: ExtractedRequirements,
): PlanParseResult {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(raw));
  } catch {
    return {
      success: false,
      violations: [{ path: "(root)", message: "Response was not valid JSON" }],
    };
  }

  const result = ImplementationPlanSchema.safeParse(json);
  if (!result.success) {
    return {
      success: false,
      violations: result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }

  const unknownIds = findUnknownRequirementIds(result.data, requirements);
  if (unknownIds.length > 0) {
    return { success: false, violations: unknownIds };
  }

  return { success: true, data: result.data };
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}
