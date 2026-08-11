import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/llm/mock-provider";
import { ModelProviderError } from "@/lib/llm/types";
import { TICKET_FIXTURES } from "@/lib/ticket/fixtures";
import { extractRequirements } from "./extract";

const ticket = TICKET_FIXTURES[0].ticket;

const validOutput = JSON.stringify({
  summary: "Add a CSV export to the board activity log.",
  explicitRequirements: [
    { id: "R1", text: "Export the activity log as CSV", sourceQuote: "export a board's activity log to CSV" },
  ],
  impliedRequirements: [{ id: "I1", text: "Escape commas and quotes in CSV cells" }],
  ambiguities: [{ question: "Which timezone for timestamps?", why: "Affects the exported values" }],
  missingInformation: ["Maximum export size"],
  clarificationNeeded: false,
});

// Valid JSON, wrong shape: clarificationNeeded is a string, summary is missing.
const schemaViolatingOutput = JSON.stringify({
  explicitRequirements: [],
  impliedRequirements: [],
  ambiguities: [],
  missingInformation: [],
  clarificationNeeded: "no",
});

describe("extractRequirements", () => {
  it("succeeds on the first attempt when output is valid", async () => {
    const provider = new MockProvider({ turns: [{ text: validOutput }] });

    const run = await extractRequirements(provider, ticket);

    expect(run.status).toBe("success");
    expect(run.attempts).toHaveLength(1);
    expect(run.attempts[0].outcome).toBe("valid");
    expect(run.data?.summary).toContain("CSV");
    expect(provider.calls).toBe(1);
  });

  it("repairs invalid output and succeeds on the retry", async () => {
    const provider = new MockProvider({
      turns: [{ text: schemaViolatingOutput }, { text: validOutput }],
    });

    const run = await extractRequirements(provider, ticket);

    expect(run.status).toBe("success");
    expect(run.attempts).toHaveLength(2);
    expect(run.attempts[0].outcome).toBe("schema_violation");
    expect(run.attempts[1].outcome).toBe("valid");
  });

  it("feeds the validation errors back to the model on the repair turn", async () => {
    const provider = new MockProvider({
      turns: [{ text: schemaViolatingOutput }, { text: validOutput }],
    });

    await extractRequirements(provider, ticket);

    // Second request carries the bad output plus the specific violations.
    const repairRequest = provider.requests[1];
    expect(repairRequest.messages).toHaveLength(3);
    expect(repairRequest.messages[1].role).toBe("assistant");
    expect(repairRequest.messages[1].content).toBe(schemaViolatingOutput);
    expect(repairRequest.messages[2].content).toMatch(/failed schema validation/i);
    expect(repairRequest.messages[2].content).toContain("summary");
  });

  it("stops after the repair budget is exhausted", async () => {
    const provider = new MockProvider({
      turns: [
        { text: schemaViolatingOutput },
        { text: schemaViolatingOutput },
        { text: schemaViolatingOutput },
      ],
    });

    const run = await extractRequirements(provider, ticket, { maxRepairs: 2 });

    expect(run.status).toBe("failed");
    expect(run.failureReason).toBe("retries_exhausted");
    expect(run.attempts).toHaveLength(3);
    expect(provider.calls).toBe(3);
  });

  it("respects a custom repair budget", async () => {
    const provider = new MockProvider({
      turns: [{ text: schemaViolatingOutput }, { text: schemaViolatingOutput }],
    });

    const run = await extractRequirements(provider, ticket, { maxRepairs: 0 });

    expect(run.status).toBe("failed");
    expect(run.attempts).toHaveLength(1);
    expect(provider.calls).toBe(1);
  });

  it("treats non-JSON output as a repairable violation", async () => {
    const provider = new MockProvider({
      turns: [{ text: "Sure! Here are the requirements:" }, { text: validOutput }],
    });

    const run = await extractRequirements(provider, ticket);

    expect(run.attempts[0].outcome).toBe("schema_violation");
    expect(run.attempts[0].violations[0].message).toMatch(/not valid JSON/i);
    expect(run.status).toBe("success");
  });

  it("accepts valid JSON wrapped in a markdown code fence", async () => {
    const provider = new MockProvider({
      turns: [{ text: "```json\n" + validOutput + "\n```" }],
    });

    const run = await extractRequirements(provider, ticket);

    expect(run.status).toBe("success");
  });

  it("aborts without retrying on a non-retryable provider error", async () => {
    const provider = new MockProvider({
      turns: [{ error: new ModelProviderError("invalid api key", { retryable: false }) }],
    });

    const run = await extractRequirements(provider, ticket);

    expect(run.status).toBe("failed");
    expect(run.failureReason).toBe("provider_error");
    expect(run.attempts[0].providerError).toBe("invalid api key");
    expect(provider.calls).toBe(1);
  });

  it("records tokens, latency, and cost across every attempt", async () => {
    let clock = 0;
    const provider = new MockProvider({
      model: "claude-opus-5",
      turns: [
        { text: schemaViolatingOutput, usage: { inputTokens: 1000, outputTokens: 200 } },
        { text: validOutput, usage: { inputTokens: 1500, outputTokens: 300 } },
      ],
    });

    const run = await extractRequirements(provider, ticket, {
      now: () => (clock += 50),
    });

    expect(run.totalUsage).toEqual({ inputTokens: 2500, outputTokens: 500 });
    expect(run.totalLatencyMs).toBe(100);
    // (2500/1e6 * $5) + (500/1e6 * $25) = 0.0125 + 0.0125
    expect(run.totalEstimatedCostUsd).toBeCloseTo(0.025);
  });
});
