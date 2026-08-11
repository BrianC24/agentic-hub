import { formatViolations, type SchemaViolation } from "@/lib/llm/structured";
import type { ExtractedRequirements } from "@/lib/requirements/schema";
import type { Ticket } from "@/lib/ticket/schema";

export const PLANNING_SYSTEM_PROMPT = `You write an implementation plan for an engineering ticket, given requirements already extracted from it.

Return a single JSON object with exactly these fields:
- approach: two or three sentences describing the overall strategy.
- steps: array of { id, description, addressesRequirements, files } — ordered implementation steps. id is a STRING label such as "S1", "S2" — never a bare number. addressesRequirements is an array of STRINGS listing the requirement ids this step satisfies, and every id must be one you were given. files is an array of STRINGS listing paths expected to change, and may be empty.
- testStrategy: array of strings — how the change will be verified. At least one entry.
- risks: array of { description, mitigation } — what could go wrong and what reduces that.
- outOfScope: array of strings — work deliberately not being done.

Rules:
- Every explicit requirement must be addressed by at least one step.
- Only cite requirement ids that were given to you. Do not invent ids.
- If the requirements say clarification is needed, still produce a plan, but list the open questions in risks.
- Prefer the simplest approach that satisfies the requirements.
- Respond with the JSON object only. No prose, no markdown code fence.`;

export function buildPlanningPrompt(
  ticket: Ticket,
  requirements: ExtractedRequirements,
): string {
  const explicit = requirements.explicitRequirements
    .map((r) => `- ${r.id}: ${r.text}`)
    .join("\n");
  const implied = requirements.impliedRequirements
    .map((r) => `- ${r.id}: ${r.text}`)
    .join("\n");
  const ambiguities = requirements.ambiguities.map((a) => `- ${a.question}`).join("\n");

  return `Ticket ${ticket.id}: ${ticket.title}

Summary of the request:
${requirements.summary}

Explicit requirements:
${explicit || "(none)"}

Implied requirements:
${implied || "(none)"}

Open ambiguities:
${ambiguities || "(none)"}

Clarification needed before work starts: ${requirements.clarificationNeeded ? "yes" : "no"}`;
}

export function buildPlanRepairPrompt(violations: SchemaViolation[]): string {
  return `Your previous response failed validation:

${formatViolations(violations)}

Return the corrected JSON object only. Do not explain the error or apologize.`;
}
