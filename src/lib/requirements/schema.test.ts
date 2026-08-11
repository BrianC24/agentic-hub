import { describe, expect, it } from "vitest";
import { buildQuotableText, parseExtraction } from "./schema";

const TICKET_TEXT = buildQuotableText({
  title: "Add CSV export to board activity log",
  description:
    "Team leads want to export a board's activity log to CSV\nfor weekly status reports.",
  acceptanceCriteria: ["Exported CSV respects the active date-range filter"],
});

function extraction(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    summary: "Add CSV export.",
    explicitRequirements: [
      {
        id: "R1",
        text: "Export the log as CSV",
        sourceQuote: "export a board's activity log to CSV",
      },
    ],
    impliedRequirements: [{ id: "I1", text: "Escape commas in cells" }],
    ambiguities: [],
    missingInformation: [],
    clarificationNeeded: false,
    ...overrides,
  });
}

describe("parseExtraction — structural", () => {
  it("accepts well-formed output with a genuine quote", () => {
    const result = parseExtraction(extraction(), TICKET_TEXT);
    expect(result.success).toBe(true);
  });

  it("reports non-JSON separately from schema failures", () => {
    const result = parseExtraction("Here are the requirements:", TICKET_TEXT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.violations[0].message).toMatch(/not valid JSON/i);
    }
  });

  it("unwraps a markdown code fence", () => {
    const result = parseExtraction("```json\n" + extraction() + "\n```", TICKET_TEXT);
    expect(result.success).toBe(true);
  });
});

describe("parseExtraction — verbatim quote rule", () => {
  it("rejects a fabricated quote that never appears in the ticket", () => {
    const raw = extraction({
      explicitRequirements: [
        {
          id: "R1",
          text: "Export the log as CSV",
          sourceQuote: "the export must complete within two seconds",
        },
      ],
    });

    const result = parseExtraction(raw, TICKET_TEXT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.violations[0].path).toBe("explicitRequirements.0.sourceQuote");
      expect(result.violations[0].message).toMatch(/verbatim/i);
    }
  });

  it("rejects a paraphrase of real ticket text", () => {
    // Every word appears in the ticket, but not in this order — the failure
    // mode a schema check cannot see.
    const raw = extraction({
      explicitRequirements: [
        { id: "R1", text: "Export", sourceQuote: "export the activity log of a board to CSV" },
      ],
    });

    expect(parseExtraction(raw, TICKET_TEXT).success).toBe(false);
  });

  it("tolerates a quote spanning a line break in the source", () => {
    const raw = extraction({
      explicitRequirements: [
        {
          id: "R1",
          text: "Export for reporting",
          sourceQuote: "activity log to CSV for weekly status reports",
        },
      ],
    });

    expect(parseExtraction(raw, TICKET_TEXT).success).toBe(true);
  });

  it("tolerates a case difference", () => {
    const raw = extraction({
      explicitRequirements: [
        { id: "R1", text: "Export", sourceQuote: "Export A Board's Activity Log To CSV" },
      ],
    });

    expect(parseExtraction(raw, TICKET_TEXT).success).toBe(true);
  });

  it("requires explicit requirements to cite something", () => {
    const raw = extraction({
      explicitRequirements: [{ id: "R1", text: "Export the log as CSV" }],
    });

    const result = parseExtraction(raw, TICKET_TEXT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.violations[0].message).toMatch(/must cite a sourceQuote/i);
    }
  });

  it("rejects an implied requirement that cites a quote", () => {
    const raw = extraction({
      impliedRequirements: [
        { id: "I1", text: "Escape commas", sourceQuote: "export a board's activity log to CSV" },
      ],
    });

    const result = parseExtraction(raw, TICKET_TEXT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.violations[0].path).toBe("impliedRequirements.0.sourceQuote");
    }
  });

  it("reports every bad quote at once so one repair turn can fix them all", () => {
    const raw = extraction({
      explicitRequirements: [
        { id: "R1", text: "a", sourceQuote: "invented one" },
        { id: "R2", text: "b", sourceQuote: "invented two" },
      ],
    });

    const result = parseExtraction(raw, TICKET_TEXT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.violations).toHaveLength(2);
    }
  });
});
