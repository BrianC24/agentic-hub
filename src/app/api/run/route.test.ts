import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TICKET_FIXTURES } from "@/lib/ticket/fixtures";

/**
 * Tests for the run endpoint.
 *
 * These are the files a reviewer reads when thinking about security, and they
 * were previously covered only by curl commands run by hand. The properties
 * that matter here are refusals, not happy paths: a request must never be able
 * to escalate itself into spending money.
 */

const ticket = TICKET_FIXTURES[0].ticket;

function post(body: unknown): Request {
  return new Request("http://test/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  // Default to a keyless deployment — the configuration a public deploy uses.
  delete process.env.LLM_PROVIDER;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_MODEL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function loadRoute() {
  return import("./route");
}

describe("GET /api/run", () => {
  it("reports live disabled when no provider is configured", async () => {
    const { GET } = await loadRoute();
    const body = await (await GET()).json();

    expect(body.liveEnabled).toBe(false);
    expect(Array.isArray(body.models)).toBe(true);
  });

  it("reports live enabled once the provider is configured", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    const { GET } = await loadRoute();
    const body = await (await GET()).json();

    expect(body.liveEnabled).toBe(true);
  });
});

describe("POST /api/run — input validation", () => {
  it("rejects a non-JSON body", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new Request("http://test/api/run", { method: "POST", body: "not json" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a ticket that fails schema validation", async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ ticket: { id: "" } }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.violations.length).toBeGreaterThan(0);
  });

  it("rejects a model that is not on the allowlist", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post({ ticket, fixtureKey: "clear-feature-request", model: "claude-fable-5" }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/unsupported model/i);
  });
});

describe("POST /api/run — provider selection", () => {
  it("serves a replay when a recording exists", async () => {
    const { POST } = await loadRoute();
    const body = await (
      await POST(post({ ticket, fixtureKey: "clear-feature-request", mode: "replay" }))
    ).json();

    expect(body.mode).toBe("replay");
    expect(body.run.stage).toBe("awaiting_approval");
  });

  it("cannot be escalated to a live call by the request body", async () => {
    // The property that keeps a public deployment safe: asking for live mode
    // on a server with no provider is served as replay, not honoured.
    const { POST } = await loadRoute();
    const body = await (
      await POST(post({ ticket, fixtureKey: "clear-feature-request", mode: "live", model: "claude-opus-5" }))
    ).json();

    expect(body.mode).toBe("replay");
  });

  it("refuses a ticket it has no recording for", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post({ ticket: { ...ticket, id: "UNKNOWN-1" }, fixtureKey: null, mode: "replay" }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/no replay recording/i);
  });

  it("returns 503 rather than crashing when live is on but the key is missing", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    const { POST } = await loadRoute();
    const response = await POST(post({ ticket, fixtureKey: "clear-feature-request", mode: "live" }));

    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/ANTHROPIC_API_KEY/);
  });
});

describe("POST /api/run — run handle", () => {
  it("issues an unguessable run id for a run awaiting approval", async () => {
    const { POST } = await loadRoute();
    const body = await (
      await POST(post({ ticket, fixtureKey: "clear-feature-request", mode: "replay" }))
    ).json();

    expect(body.runId).toMatch(/^run_[0-9a-f-]{36}$/);
  });
});
