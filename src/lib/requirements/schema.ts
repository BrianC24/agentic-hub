import { z } from "zod";
import type { SchemaViolation, StructuredParseResult } from "@/lib/llm/structured";

/**
 * Contract for requirement-extraction output.
 *
 * This is the boundary between "the model said something" and "the workflow has
 * data". Model output is untrusted input: nothing downstream reads a field that
 * hasn't passed through this schema.
 */

export const RequirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  /** Quote from the ticket supporting this requirement; absent for implied ones. */
  sourceQuote: z.string().min(1).optional(),
});

export const AmbiguitySchema = z.object({
  question: z.string().min(1),
  why: z.string().min(1),
});

export const ExtractedRequirementsSchema = z.object({
  summary: z.string().min(1, "Summary is required"),
  explicitRequirements: z.array(RequirementSchema),
  impliedRequirements: z.array(RequirementSchema),
  ambiguities: z.array(AmbiguitySchema),
  missingInformation: z.array(z.string().min(1)),
  /** True when the ticket cannot responsibly proceed without a human answer. */
  clarificationNeeded: z.boolean(),
});

export type Requirement = z.infer<typeof RequirementSchema>;
export type Ambiguity = z.infer<typeof AmbiguitySchema>;
export type ExtractedRequirements = z.infer<typeof ExtractedRequirementsSchema>;

export type { SchemaViolation } from "@/lib/llm/structured";

export type ExtractionParseResult = StructuredParseResult<ExtractedRequirements>;

/**
 * Compared with whitespace collapsed and case ignored.
 *
 * The goal is to catch fabricated or paraphrased quotes, not to police
 * formatting: a quote spanning a line break, or one whose leading letter got
 * capitalised, is still honestly sourced. Anything looser would stop catching
 * invention, which is the whole point of the check.
 */
function normalizeForQuoteMatch(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** The ticket prose a sourceQuote may legitimately be drawn from. */
export function buildQuotableText(ticket: {
  title: string;
  description: string;
  acceptanceCriteria: string[];
}): string {
  return [ticket.title, ticket.description, ...ticket.acceptanceCriteria].join("\n");
}

/**
 * Checks that every explicit requirement's sourceQuote really appears in the
 * ticket.
 *
 * This is a semantic rule the schema cannot express — the shape is valid either
 * way, and only comparison against the source reveals a fabricated citation.
 * Constrained decoding would not catch it either, which is precisely why the
 * repair loop needs to exist.
 */
function findQuoteViolations(
  data: ExtractedRequirements,
  quotableText: string,
): SchemaViolation[] {
  const haystack = normalizeForQuoteMatch(quotableText);
  const violations: SchemaViolation[] = [];

  data.explicitRequirements.forEach((requirement, index) => {
    if (!requirement.sourceQuote) {
      violations.push({
        path: `explicitRequirements.${index}.sourceQuote`,
        message: "An explicit requirement must cite a sourceQuote from the ticket",
      });
      return;
    }
    if (!haystack.includes(normalizeForQuoteMatch(requirement.sourceQuote))) {
      violations.push({
        path: `explicitRequirements.${index}.sourceQuote`,
        message: `sourceQuote must be text copied verbatim from the ticket, but "${requirement.sourceQuote}" does not appear in it`,
      });
    }
  });

  data.impliedRequirements.forEach((requirement, index) => {
    if (requirement.sourceQuote) {
      violations.push({
        path: `impliedRequirements.${index}.sourceQuote`,
        message:
          "An implied requirement must not cite a sourceQuote — if the ticket states it, it is explicit",
      });
    }
  });

  return violations;
}

/**
 * Parses raw model text into validated requirements.
 *
 * Three failure modes are reported separately, because the repair prompt
 * differs for each: text that isn't JSON, JSON of the wrong shape, and
 * well-shaped JSON whose citations don't hold up against the ticket.
 */
export function parseExtraction(raw: string, quotableText: string): ExtractionParseResult {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(raw));
  } catch {
    return {
      success: false,
      violations: [{ path: "(root)", message: "Response was not valid JSON" }],
    };
  }

  const result = ExtractedRequirementsSchema.safeParse(json);
  if (!result.success) {
    return {
      success: false,
      violations: result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }

  const quoteViolations = findQuoteViolations(result.data, quotableText);
  if (quoteViolations.length > 0) {
    return { success: false, violations: quoteViolations };
  }

  return { success: true, data: result.data };
}

/** Models often wrap JSON in a ```json fence despite instructions not to. */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

