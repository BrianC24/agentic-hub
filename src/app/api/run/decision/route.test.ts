import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TICKET_FIXTURES } from "@/lib/ticket/fixtures";

/**
 * Tests for the decision endpoint.
 *
 * The security property under test: the caller supplies only an opaque run id.
 * Everything the repair bound depends on lives server-side, so a crafted
 * request cannot buy extra replans or inject text into the next prompt.
 */

const ticket = TICKET_FIXTURES[0].ticket;
const ORIGINAL_ENV = { ...process.env };

function post(body: unknown): Request {
  return new Request("http://test/api/run/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetModules();
  delete process.env.LLM_PROVIDER;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/** Creates a genuine run through the run endpoint and returns its id. */
async function createRun(): Promise<string> {
  const { POST } = await import("../route");
  const body = await (
    await POST(
      new Request("http://test/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, fixtureKey: "clear-feature-request", mode: "replay" }),
      }),
    )
  ).json();
  return body.runId;
}

describe("POST /api/run/decision: refusing forged state", () => {
  it("ignores a run object supplied by the caller", async () => {
    // The original exploit: a forged run with a negative repair count bought
    // unlimited replans, because the bound was checked against client input.
    const { POST } = await import("./route");
    const response = await POST(
      post({
        decision: "rejected",
        note: "forged",
        ticket,
        run: {
          id: "forged",
          stage: "awaiting_approval",
          repairRounds: -9999,
          events: [],
          approval: null,
          failureReason: null,
        },
        artifacts: { requirements: {}, plan: null, validation: null, evaluation: null, stageRuns: [] },
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/runId is required/i);
  });

  it("rejects an unknown run id", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      post({ decision: "approved", runId: "run_00000000-0000-0000-0000-000000000000" }),
    );

    expect(response.status).toBe(404);
  });

  it("rejects a malformed run id", async () => {
    const { POST } = await import("./route");
    expect((await POST(post({ decision: "approved", runId: "" }))).status).toBe(400);
    expect((await POST(post({ decision: "approved", runId: 42 }))).status).toBe(400);
    expect((await POST(post({ decision: "approved", runId: "x".repeat(500) }))).status).toBe(400);
  });

  it("rejects an unknown decision", async () => {
    const { POST } = await import("./route");
    const response = await POST(post({ decision: "maybe", runId: "run_x" }));
    expect(response.status).toBe(400);
  });

  it("rejects a non-JSON body", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://test/api/run/decision", { method: "POST", body: "{{" }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/run/decision: approval", () => {
  it("completes the run and records the note", async () => {
    const runId = await createRun();
    const { POST } = await import("./route");

    const body = await (await POST(post({ decision: "approved", note: "ship it", runId }))).json();

    expect(body.run.stage).toBe("complete");
    expect(body.run.approval.decision).toBe("approved");
    expect(body.run.approval.note).toBe("ship it");
  });

  it("costs nothing, since approving calls no model", async () => {
    const runId = await createRun();
    const { POST } = await import("./route");
    const before = await (await POST(post({ decision: "approved", runId }))).json();

    expect(before.mode).toBe("none");
    expect(before.totals.modelCalls).toBe(3);
  });

  it("consumes the run id so a decision cannot be replayed", async () => {
    const runId = await createRun();
    const { POST } = await import("./route");

    expect((await POST(post({ decision: "approved", runId }))).status).toBe(200);
    expect((await POST(post({ decision: "approved", runId }))).status).toBe(404);
  });
});

describe("POST /api/run/decision: rejection", () => {
  it("refuses to replan on a deployment with no live provider", async () => {
    const runId = await createRun();
    const { POST } = await import("./route");

    const response = await POST(post({ decision: "rejected", note: "no rollback", runId }));

    // A recording cannot cover a round that exists because a reviewer asked
    // for it, so this must refuse rather than silently doing nothing.
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/live model calls/i);
  });

  it("rejects a model that is not on the allowlist before doing any work", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const runId = await createRun();
    const { POST } = await import("./route");

    const response = await POST(
      post({ decision: "rejected", runId, model: "claude-fable-5" }),
    );

    expect(response.status).toBe(400);
  });
});
