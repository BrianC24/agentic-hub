/**
 * Daily spend ceiling for live model calls.
 *
 * Enforced by reservation rather than measurement: an estimate is deducted
 * before the call, then reconciled against what the run actually cost. Checking
 * spend afterwards is too late — the request that breaks the budget has already
 * been paid for.
 *
 * In-memory, with the consequences stated rather than discovered: across
 * multiple serverless instances each holds its own ledger, so the effective
 * ceiling is the configured amount times the instance count. For a low-traffic
 * deployment that is usually one instance, but it is a real limitation and the
 * only correct fix is shared storage.
 */

export interface Reservation {
  id: string;
  estimatedUsd: number;
}

export type ReserveResult =
  | { ok: true; reservation: Reservation; remainingUsd: number }
  | { ok: false; reason: "budget_exhausted"; remainingUsd: number; resetsAt: number };

export const DEFAULT_DAILY_BUDGET_USD = 2;

export class SpendLedger {
  private spentUsd = 0;
  private reservedUsd = 0;
  private windowStart: number;
  private readonly open = new Map<string, number>();
  private counter = 0;

  constructor(
    private readonly dailyBudgetUsd: number = DEFAULT_DAILY_BUDGET_USD,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.windowStart = this.now();
  }

  private readonly windowMs = 24 * 60 * 60 * 1000;

  private rollWindow(): void {
    if (this.now() - this.windowStart >= this.windowMs) {
      this.windowStart = this.now();
      this.spentUsd = 0;
      // Reservations in flight across a rollover are deliberately kept: their
      // calls are still running and will settle against the new window.
    }
  }

  get remainingUsd(): number {
    this.rollWindow();
    return Math.max(0, this.dailyBudgetUsd - this.spentUsd - this.reservedUsd);
  }

  get resetsAt(): number {
    return this.windowStart + this.windowMs;
  }

  get budgetUsd(): number {
    return this.dailyBudgetUsd;
  }

  /** Holds budget for a call that is about to be made. */
  reserve(estimatedUsd: number): ReserveResult {
    this.rollWindow();
    if (estimatedUsd > this.remainingUsd) {
      return {
        ok: false,
        reason: "budget_exhausted",
        remainingUsd: this.remainingUsd,
        resetsAt: this.resetsAt,
      };
    }

    this.counter += 1;
    const id = `res_${this.counter}`;
    this.open.set(id, estimatedUsd);
    this.reservedUsd += estimatedUsd;
    return { ok: true, reservation: { id, estimatedUsd }, remainingUsd: this.remainingUsd };
  }

  /**
   * Reconciles a reservation against the real cost.
   *
   * A run that overran its estimate still charges what it actually cost, so a
   * cheap estimate cannot be used to slip past the ceiling repeatedly.
   */
  settle(reservation: Reservation, actualUsd: number | null): void {
    const held = this.open.get(reservation.id);
    if (held === undefined) return;
    this.open.delete(reservation.id);
    this.reservedUsd -= held;
    // A null cost means the model was unpriced; charge the estimate rather
    // than nothing, so unknown spend cannot be unlimited.
    this.spentUsd += actualUsd ?? held;
  }

  /** Returns held budget when a call never happened. */
  release(reservation: Reservation): void {
    const held = this.open.get(reservation.id);
    if (held === undefined) return;
    this.open.delete(reservation.id);
    this.reservedUsd -= held;
  }
}

function readBudget(): number {
  const raw = Number(process.env.LIVE_DAILY_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_BUDGET_USD;
}

const globalForLedger = globalThis as unknown as { __agenticHubLedger?: SpendLedger };

export const spendLedger: SpendLedger =
  globalForLedger.__agenticHubLedger ?? new SpendLedger(readBudget());

if (!globalForLedger.__agenticHubLedger) {
  globalForLedger.__agenticHubLedger = spendLedger;
}
