import { describe, expect, it } from "vitest";
import { SpendLedger } from "./budget";
import { RateLimiter, clientKey } from "./rate-limit";
import { checkModelAffordable, checkTicketSize, MAX_LIVE_TICKET_CHARS } from "./limits";
import { TICKET_FIXTURES } from "@/lib/ticket/fixtures";

const ticket = TICKET_FIXTURES[0].ticket;

describe("SpendLedger", () => {
  it("allows spending inside the budget", () => {
    const ledger = new SpendLedger(2, () => 0);
    const result = ledger.reserve(0.02);
    expect(result.ok).toBe(true);
  });

  it("holds reserved budget before the call completes", () => {
    // The whole point: a concurrent request must not see the money as
    // available just because the first call has not returned yet.
    const ledger = new SpendLedger(0.05, () => 0);
    const first = ledger.reserve(0.04);
    expect(first.ok).toBe(true);
    expect(ledger.remainingUsd).toBeCloseTo(0.01);

    const second = ledger.reserve(0.04);
    expect(second.ok).toBe(false);
  });

  it("charges what a run actually cost, not the estimate", () => {
    const ledger = new SpendLedger(1, () => 0);
    const reserved = ledger.reserve(0.02);
    if (!reserved.ok) throw new Error("should reserve");

    ledger.settle(reserved.reservation, 0.05);
    // Otherwise a cheap estimate could be used to slip past the ceiling.
    expect(ledger.remainingUsd).toBeCloseTo(0.95);
  });

  it("charges the estimate when the real cost is unknown", () => {
    const ledger = new SpendLedger(1, () => 0);
    const reserved = ledger.reserve(0.02);
    if (!reserved.ok) throw new Error("should reserve");

    ledger.settle(reserved.reservation, null);
    // Unpriced must not mean free, or unknown spend would be unlimited.
    expect(ledger.remainingUsd).toBeCloseTo(0.98);
  });

  it("returns held budget when a run never happened", () => {
    const ledger = new SpendLedger(1, () => 0);
    const reserved = ledger.reserve(0.5);
    if (!reserved.ok) throw new Error("should reserve");

    ledger.release(reserved.reservation);
    expect(ledger.remainingUsd).toBeCloseTo(1);
  });

  it("ignores a reservation settled twice", () => {
    const ledger = new SpendLedger(1, () => 0);
    const reserved = ledger.reserve(0.1);
    if (!reserved.ok) throw new Error("should reserve");

    ledger.settle(reserved.reservation, 0.1);
    ledger.settle(reserved.reservation, 0.1);
    expect(ledger.remainingUsd).toBeCloseTo(0.9);
  });

  it("refuses once the budget is spent", () => {
    const ledger = new SpendLedger(0.05, () => 0);
    const first = ledger.reserve(0.05);
    if (!first.ok) throw new Error("should reserve");
    ledger.settle(first.reservation, 0.05);

    const second = ledger.reserve(0.01);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("budget_exhausted");
  });

  it("resets after the daily window", () => {
    let now = 0;
    const ledger = new SpendLedger(0.05, () => now);
    const first = ledger.reserve(0.05);
    if (!first.ok) throw new Error("should reserve");
    ledger.settle(first.reservation, 0.05);

    now = 24 * 60 * 60 * 1000 + 1;
    expect(ledger.reserve(0.05).ok).toBe(true);
  });
});

describe("RateLimiter", () => {
  it("allows up to the limit then refuses", () => {
    const limiter = new RateLimiter(3, 1000, () => 0);
    for (let i = 0; i < 3; i += 1) {
      expect(limiter.check("ip").allowed).toBe(true);
      limiter.record("ip");
    }
    expect(limiter.check("ip").allowed).toBe(false);
  });

  it("tracks callers separately", () => {
    const limiter = new RateLimiter(1, 1000, () => 0);
    limiter.record("a");
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("slides rather than resetting on a boundary", () => {
    // A fixed window would let a caller spend a full quota just before the
    // boundary and another just after, doubling the intended rate.
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    limiter.record("ip");
    now = 500;
    limiter.record("ip");
    expect(limiter.check("ip").allowed).toBe(false);

    // At t=1001 the hit at 0 has aged out but the one at 500 has not, so
    // exactly one slot frees up, not the whole quota, as a fixed window
    // would have granted.
    now = 1001;
    expect(limiter.check("ip").allowed).toBe(true);
    limiter.record("ip");
    expect(limiter.check("ip").allowed).toBe(false);
  });

  it("does not consume quota for a request that is only checked", () => {
    const limiter = new RateLimiter(1, 1000, () => 0);
    limiter.check("ip");
    limiter.check("ip");
    expect(limiter.check("ip").allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the left-most forwarded address", () => {
    const request = new Request("http://test", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
    });
    expect(clientKey(request)).toBe("203.0.113.7");
  });

  it("falls back to a shared key when no address is present", () => {
    // Collapsing to one shared quota is the safe failure: without a trusted
    // proxy header, per-caller quotas would be trivially bypassed.
    expect(clientKey(new Request("http://test"))).toBe("unknown");
  });
});

describe("input and model limits", () => {
  it("accepts a normal ticket", () => {
    expect(checkTicketSize(ticket).ok).toBe(true);
  });

  it("rejects an oversized ticket", () => {
    const huge = { ...ticket, description: "x".repeat(MAX_LIVE_TICKET_CHARS + 1) };
    const result = checkTicketSize(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/every prompt/i);
  });

  it("admits the cheap model and refuses expensive ones by default", () => {
    expect(checkModelAffordable("claude-haiku-4-5", {} as NodeJS.ProcessEnv).ok).toBe(true);
    expect(checkModelAffordable("claude-opus-5", {} as NodeJS.ProcessEnv).ok).toBe(false);
  });

  it("lets the operator raise the per-run ceiling", () => {
    const env = { LIVE_MAX_RUN_COST_USD: "1.00" } as unknown as NodeJS.ProcessEnv;
    expect(checkModelAffordable("claude-opus-5", env).ok).toBe(true);
  });

  it("rejects a model that is not selectable at all", () => {
    expect(checkModelAffordable("claude-fable-5", {} as NodeJS.ProcessEnv).ok).toBe(false);
  });
});
