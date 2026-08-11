import { runStructured, type StructuredRun } from "@/lib/llm/structured";
import type { ModelProvider } from "@/lib/llm/types";
import type { ExtractedRequirements } from "@/lib/requirements/schema";
import type { Ticket } from "@/lib/ticket/schema";
import { buildPlanningPrompt, buildPlanRepairPrompt, PLANNING_SYSTEM_PROMPT } from "./prompt";
import { parsePlan, type ImplementationPlan } from "./schema";

export type PlanningRun = StructuredRun<ImplementationPlan>;

export interface PlanOptions {
  maxRepairs?: number;
  maxTokens?: number;
  now?: () => number;
  /** Feedback from a failed evaluation, appended so a repair round improves on it. */
  priorFeedback?: string;
}

/**
 * Produces an implementation plan from validated requirements.
 *
 * Reuses the same bounded repair loop as extraction. The stage-specific part is
 * the semantic rule: a step may only cite requirement ids that actually exist,
 * so a model cannot manufacture coverage by inventing them.
 */
export function planImplementation(
  provider: ModelProvider,
  ticket: Ticket,
  requirements: ExtractedRequirements,
  options: PlanOptions = {},
): Promise<PlanningRun> {
  const { priorFeedback, ...runOptions } = options;

  const basePrompt = buildPlanningPrompt(ticket, requirements);
  const prompt = priorFeedback
    ? `${basePrompt}

A previous plan was rejected for these reasons. Address them:
${priorFeedback}`
    : basePrompt;

  return runStructured<ImplementationPlan>({
    provider,
    system: PLANNING_SYSTEM_PROMPT,
    prompt,
    parse: (raw) => parsePlan(raw, requirements),
    buildRepairPrompt: buildPlanRepairPrompt,
    ...runOptions,
  });
}
