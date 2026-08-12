import type { Ticket } from "@/lib/ticket/schema";
import type { RunArtifacts } from "./orchestrator";
import type { Run } from "./run";

/**
 * Server-side store for in-flight runs.
 *
 * The client used to post the whole run and artifacts back when making an
 * approval decision, which meant the repair bound was enforced against a
 * number the caller controlled — sending repairRounds: 0 forever bought
 * unlimited replans, and the artifacts fed straight into the next prompt.
 * Holding the state here and handing out only an opaque id closes both.
 *
 * Deliberately in-memory: this project has no database, and pretending
 * otherwise would be worse than the honest limitation. Consequences, stated
 * rather than discovered:
 *
 *  - A restart drops every in-flight run.
 *  - Across multiple serverless instances a decision may land on an instance
 *    that never saw the run, and gets a clean "run not found" rather than
 *    silently wrong behaviour.
 *  - Entries expire, so a tab left open overnight cannot approve a stale run.
 */

export interface StoredRun {
  run: Run;
  artifacts: RunArtifacts;
  ticket: Ticket;
  storedAt: number;
}

/** Long enough to read a report and decide; short enough to bound memory. */
export const RUN_TTL_MS = 30 * 60 * 1000;

/** Bounds memory on a public deployment where anyone can create runs. */
export const MAX_STORED_RUNS = 200;

export class RunStore {
  private readonly runs = new Map<string, StoredRun>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  get size(): number {
    return this.runs.size;
  }

  save(id: string, entry: Omit<StoredRun, "storedAt">): void {
    this.evictExpired();
    // Oldest-first eviction. Map preserves insertion order, and re-saving an
    // existing id deletes first so it moves to the end rather than keeping its
    // original position.
    this.runs.delete(id);
    while (this.runs.size >= MAX_STORED_RUNS) {
      const oldest = this.runs.keys().next();
      if (oldest.done) break;
      this.runs.delete(oldest.value);
    }
    this.runs.set(id, { ...entry, storedAt: this.now() });
  }

  get(id: string): StoredRun | undefined {
    const entry = this.runs.get(id);
    if (!entry) return undefined;
    if (this.now() - entry.storedAt > RUN_TTL_MS) {
      this.runs.delete(id);
      return undefined;
    }
    return entry;
  }

  delete(id: string): void {
    this.runs.delete(id);
  }

  private evictExpired(): void {
    const cutoff = this.now() - RUN_TTL_MS;
    for (const [id, entry] of this.runs) {
      if (entry.storedAt <= cutoff) this.runs.delete(id);
    }
  }
}

/**
 * Process-wide store.
 *
 * Stashed on globalThis so Next.js dev-mode module reloading does not silently
 * hand out a fresh empty store mid-session, which would look like runs
 * randomly disappearing.
 */
const globalForStore = globalThis as unknown as { __agenticHubRunStore?: RunStore };

export const runStore: RunStore = globalForStore.__agenticHubRunStore ?? new RunStore();

if (!globalForStore.__agenticHubRunStore) {
  globalForStore.__agenticHubRunStore = runStore;
}

/** Unguessable id so one visitor cannot act on another's run. */
export function newRunId(): string {
  return `run_${crypto.randomUUID()}`;
}
