import { z } from "zod";

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

export interface SchemaViolation {
  path: string;
  message: string;
}

export type ExtractionParseResult =
  | { success: true; data: ExtractedRequirements }
  | { success: false; violations: SchemaViolation[] };

/**
 * Parses raw model text into validated requirements.
 *
 * Handles the two distinct failure modes separately, because the repair prompt
 * differs: text that isn't JSON at all, and JSON that doesn't match the schema.
 */
export function parseExtraction(raw: string): ExtractionParseResult {
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
  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    violations: result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message,
    })),
  };
}

/** Models often wrap JSON in a ```json fence despite instructions not to. */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

export function formatViolations(violations: SchemaViolation[]): string {
  return violations.map((v) => `- ${v.path}: ${v.message}`).join("\n");
}
