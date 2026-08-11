import type { ModelProvider, ModelRequest, ModelResponse } from "./types";

/** One request/response pair, captured verbatim. */
export interface RecordedExchange {
  request: ModelRequest;
  response: ModelResponse;
  latencyMs: number;
}

/**
 * Wraps a real provider and records every exchange.
 *
 * A decorator rather than a change to the adapter, so recording is opt-in per
 * run and the production path stays free of capture logic.
 */
export class RecordingProvider implements ModelProvider {
  readonly name: string;
  readonly model: string;
  readonly exchanges: RecordedExchange[] = [];

  constructor(private readonly inner: ModelProvider) {
    this.name = `recording(${inner.name})`;
    this.model = inner.model;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const startedAt = Date.now();
    const response = await this.inner.complete(request);
    this.exchanges.push({ request, response, latencyMs: Date.now() - startedAt });
    return response;
  }
}

/**
 * Replays recorded responses in order, making no network calls.
 *
 * This is what lets the public demo run the genuine workflow — the same
 * orchestrator, validators, and state machine — at zero cost and with no key.
 * Only the transport is swapped.
 */
export class ReplayProvider implements ModelProvider {
  readonly name = "replay";
  readonly model: string;
  private index = 0;

  constructor(
    private readonly exchanges: RecordedExchange[],
    model?: string,
  ) {
    this.model = model ?? exchanges[0]?.response.model ?? "replay";
  }

  get remaining(): number {
    return this.exchanges.length - this.index;
  }

  async complete(): Promise<ModelResponse> {
    const exchange = this.exchanges[this.index];
    if (!exchange) {
      throw new Error(
        `ReplayProvider exhausted after ${this.index} call(s): the recording does not cover this path. ` +
          `Re-record if the workflow changed.`,
      );
    }
    this.index += 1;
    return exchange.response;
  }
}
