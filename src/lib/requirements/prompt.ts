import type { Ticket } from "@/lib/ticket/schema";
import { formatViolations, type SchemaViolation } from "@/lib/llm/structured";

export const EXTRACTION_SYSTEM_PROMPT = `You extract engineering requirements from a Jira-style ticket.

Return a single JSON object with exactly these fields:
- summary: one or two sentences describing what the ticket asks for.
- explicitRequirements: array of { id, text, sourceQuote } — things the ticket states directly. sourceQuote must be a verbatim substring of the ticket.
- impliedRequirements: array of { id, text } — things a competent engineer would infer but the ticket does not state. Omit sourceQuote here.
- ambiguities: array of { question, why } — genuine ambiguities that would change the implementation.
- missingInformation: array of strings — information needed before work can start.
- clarificationNeeded: boolean — true only when the ticket cannot responsibly proceed without a human answer.

Rules:
- Do not invent requirements the ticket does not support. An empty array is a valid answer.
- Prefer flagging an ambiguity over guessing an interpretation.
- Respond with the JSON object only. No prose, no markdown code fence.`;

export function buildExtractionPrompt(ticket: Ticket): string {
  const criteria =
    ticket.acceptanceCriteria.length > 0
      ? ticket.acceptanceCriteria.map((c) => `- ${c}`).join("\n")
      : "(none provided)";

  return `Ticket ${ticket.id}
Type: ${ticket.type}
Priority: ${ticket.priority}
Title: ${ticket.title}

Description:
${ticket.description}

Acceptance criteria:
${criteria}`;
}

/**
 * The repair turn. The model sees its own invalid output plus the specific
 * validation failures, and that error context is what makes the retry more than a
 * reroll of the same prompt.
 */
export function buildRepairPrompt(violations: SchemaViolation[]): string {
  return `Your previous response failed schema validation:

${formatViolations(violations)}

Return the corrected JSON object only. Do not explain the error or apologize.`;
}
