import { formatViolations, runStructured, type SchemaViolation, type StructuredRun } from "@/lib/llm/structured";
import type { ModelProvider } from "@/lib/llm/types";
import type { ImplementationPlan } from "@/lib/planning/schema";
import type { ExtractedRequirements } from "@/lib/requirements/schema";
import type { Ticket } from "@/lib/ticket/schema";
import { PLAN_RUBRIC } from "./rubric";
import { parseEvaluation, scoreEvaluation, type Evaluation, type EvaluationVerdict } from "./schema";

export type EvaluationRun = StructuredRun<Evaluation>;

export const EVALUATION_SYSTEM_PROMPT = `You evaluate an engineering implementation plan against a fixed rubric.

Score every criterion exactly once, on a 1-5 integer scale, using the anchors given. For each score, cite the specific part of the plan that justifies it — quote it or name the step id. A score without concrete evidence is not acceptable.

Return a single JSON object with exactly these fields:
- scores: array of { criterionId, score, evidence } — one entry per rubric criterion, no more, no less.
- overallComment: two or three sentences summarising the plan's fitness.

Rules:
- Be critical. A plan that merely looks organised is not automatically good.
- Do not re-check things that are mechanically verifiable (whether every requirement id appears, whether a test strategy field is non-empty). Those are checked elsewhere. Judge quality, not presence.
- Respond with the JSON object only. No prose, no markdown code fence.

Rubric:
${PLAN_RUBRIC.map((c) => `- ${c.id} (${c.label}): ${c.question}\n  Anchors: ${c.anchors}`).join("\n")}`;

export function buildEvaluationPrompt(
  ticket: Ticket,
  requirements: ExtractedRequirements,
  plan: ImplementationPlan,
): string {
  return `Ticket ${ticket.id}: ${ticket.title}

${ticket.description}

Requirements identified:
${requirements.explicitRequirements.map((r) => `- ${r.id}: ${r.text}`).join("\n") || "(none)"}

Ambiguities raised:
${requirements.ambiguities.map((a) => `- ${a.question}`).join("\n") || "(none)"}

Plan under evaluation:
${JSON.stringify(plan, null, 2)}`;
}

function buildEvaluationRepairPrompt(violations: SchemaViolation[]): string {
  return `Your previous response failed validation:

${formatViolations(violations)}

Return the corrected JSON object only. Do not explain the error or apologize.`;
}

export interface EvaluateOptions {
  maxRepairs?: number;
  maxTokens?: number;
  now?: () => number;
}

/**
 * Runs the rubric evaluation.
 *
 * The judge is held to the same contract as any other stage: structured
 * output, validated, with a bounded repair loop. A judge that returns
 * unparseable output is a failed check, not a silent pass.
 */
export function evaluatePlan(
  provider: ModelProvider,
  ticket: Ticket,
  requirements: ExtractedRequirements,
  plan: ImplementationPlan,
  options: EvaluateOptions = {},
): Promise<EvaluationRun> {
  return runStructured<Evaluation>({
    provider,
    system: EVALUATION_SYSTEM_PROMPT,
    prompt: buildEvaluationPrompt(ticket, requirements, plan),
    parse: parseEvaluation,
    buildRepairPrompt: buildEvaluationRepairPrompt,
    ...options,
  });
}

/** Convenience: run the evaluation and derive its verdict in one step. */
export async function evaluateAndScore(
  provider: ModelProvider,
  ticket: Ticket,
  requirements: ExtractedRequirements,
  plan: ImplementationPlan,
  options: EvaluateOptions = {},
): Promise<{ run: EvaluationRun; verdict: EvaluationVerdict | null }> {
  const run = await evaluatePlan(provider, ticket, requirements, plan, options);
  return { run, verdict: run.data ? scoreEvaluation(run.data) : null };
}
