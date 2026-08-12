import type { Ticket } from "@/lib/ticket/schema";
import { spendLedger, type Reservation } from "./budget";
import { checkModelAffordable, checkTicketSize, estimateRunCostUsd } from "./limits";
import { clientKey, liveRateLimiter } from "./rate-limit";

/**
 * One entry point for every live-run guard, so a new code path cannot
 * accidentally skip one. Checks run cheapest-first: input size and model
 * policy before rate limiting, and budget last since it holds a reservation
 * that must be released if anything downstream fails.
 */

export type GuardFailure = {
  ok: false;
  status: 400 | 402 | 429;
  error: string;
  retryAfterSeconds?: number;
};

export type GuardSuccess = {
  ok: true;
  reservation: Reservation;
  /** Call exactly once when the run finishes, with its real cost. */
  settle: (actualUsd: number | null) => void;
  /** Call if the run never happened. */
  release: () => void;
};

export function guardLiveRun(
  request: Request,
  ticket: Ticket,
  model: string,
): GuardFailure | GuardSuccess {
  const size = checkTicketSize(ticket);
  if (!size.ok) return { ok: false, status: 400, error: size.error };

  const affordable = checkModelAffordable(model);
  if (!affordable.ok) return { ok: false, status: 400, error: affordable.error };

  const key = clientKey(request);
  const rate = liveRateLimiter.check(key);
  if (!rate.allowed) {
    const seconds = Math.max(1, Math.ceil((rate.resetsAt - Date.now()) / 1000));
    return {
      ok: false,
      status: 429,
      error: `Live-run limit reached. Try again in ${Math.ceil(seconds / 60)} minute(s), or use the recorded examples, which are unlimited and free.`,
      retryAfterSeconds: seconds,
    };
  }

  const reserved = spendLedger.reserve(estimateRunCostUsd(model));
  if (!reserved.ok) {
    return {
      ok: false,
      status: 402,
      error:
        "This demo's daily budget for live model calls is spent. The recorded examples still run the full workflow for free.",
    };
  }

  // Only counted once every gate has passed, so a refused request does not
  // consume the caller's quota.
  liveRateLimiter.record(key);

  return {
    ok: true,
    reservation: reserved.reservation,
    settle: (actualUsd) => spendLedger.settle(reserved.reservation, actualUsd),
    release: () => spendLedger.release(reserved.reservation),
  };
}

/** Public status, so the UI can show limits rather than surprise a visitor. */
export function guardStatus(request: Request) {
  const rate = liveRateLimiter.check(clientKey(request));
  return {
    dailyBudgetUsd: spendLedger.budgetUsd,
    remainingBudgetUsd: Number(spendLedger.remainingUsd.toFixed(4)),
    liveRunsRemaining: rate.allowed ? rate.remaining + 1 : 0,
  };
}

export { spendLedger, liveRateLimiter, clientKey };
