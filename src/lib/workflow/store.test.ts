import { describe, expect, it } from "vitest";
import { MAX_STORED_RUNS, RUN_TTL_MS, RunStore, newRunId } from "./store";
import type { RunArtifacts } from "./orchestrator";
import type { Run } from "./run";
import { TICKET_FIXTURES } from "@/lib/ticket/fixtures";

const ticket = TICKET_FIXTURES[0].ticket;
const run = { id: "r", stage: "awaiting_approval" } as unknown as Run;
const artifacts = { stageRuns: [] } as unknown as RunArtifacts;

describe("RunStore", () => {
  it("returns what was stored", () => {
    const store = new RunStore(() => 0);
    store.save("a", { run, artifacts, ticket });
    expect(store.get("a")?.ticket.id).toBe(ticket.id);
  });

  it("returns undefined for an unknown id", () => {
    expect(new RunStore(() => 0).get("nope")).toBeUndefined();
  });

  it("expires entries past the TTL", () => {
    let now = 0;
    const store = new RunStore(() => now);
    store.save("a", { run, artifacts, ticket });

    now = RUN_TTL_MS + 1;
    // A tab left open overnight must not be able to approve a stale run.
    expect(store.get("a")).toBeUndefined();
  });

  it("keeps entries inside the TTL", () => {
    let now = 0;
    const store = new RunStore(() => now);
    store.save("a", { run, artifacts, ticket });
    now = RUN_TTL_MS - 1;
    expect(store.get("a")).toBeDefined();
  });

  it("bounds memory by evicting the oldest entries", () => {
    const store = new RunStore(() => 0);
    for (let i = 0; i < MAX_STORED_RUNS + 10; i += 1) {
      store.save(`run-${i}`, { run, artifacts, ticket });
    }

    // Anyone can create runs on a public deployment, so this must not grow
    // without limit.
    expect(store.size).toBeLessThanOrEqual(MAX_STORED_RUNS);
    expect(store.get("run-0")).toBeUndefined();
    expect(store.get(`run-${MAX_STORED_RUNS + 9}`)).toBeDefined();
  });

  it("re-saving an id refreshes it rather than duplicating", () => {
    const store = new RunStore(() => 0);
    store.save("a", { run, artifacts, ticket });
    store.save("a", { run, artifacts, ticket });
    expect(store.size).toBe(1);
  });

  it("delete removes an entry", () => {
    const store = new RunStore(() => 0);
    store.save("a", { run, artifacts, ticket });
    store.delete("a");
    expect(store.get("a")).toBeUndefined();
  });
});

describe("newRunId", () => {
  it("is unguessable and unique", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newRunId()));
    expect(ids.size).toBe(200);
    expect([...ids][0]).toMatch(/^run_[0-9a-f-]{36}$/);
  });
});
