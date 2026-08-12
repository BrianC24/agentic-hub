import {
  ModelProviderError,
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  type ModelUsage,
} from "./types";

/**
 * One scripted turn. `text` is returned as-is (including deliberately malformed
 * output); `error` makes the call throw instead, so provider failures are
 * testable without network flakiness.
 */
export type MockTurn =
  | { text: string; usage?: Partial<ModelUsage>; stopReason?: string }
  | { error: ModelProviderError };

export interface MockProviderOptions {
  model?: string;
  /** Turns are consumed in order, one per complete() call. */
  turns: MockTurn[];
}

const DEFAULT_USAGE: ModelUsage = { inputTokens: 1200, outputTokens: 400 };

/**
 * Deterministic stand-in for a real provider. Records every request it received
 * so tests can assert on what the repair loop actually sent back.
 */
export class MockProvider implements ModelProvider {
  readonly name = "mock";
  readonly model: string;
  readonly requests: ModelRequest[] = [];

  private readonly turns: MockTurn[];
  private callCount = 0;

  constructor(options: MockProviderOptions) {
    this.model = options.model ?? "mock-model";
    this.turns = options.turns;
  }

  get calls(): number {
    return this.callCount;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    // Snapshot: the repair loop mutates one messages array in place, so a
    // stored reference would make every recorded request identical.
    this.requests.push({ ...request, messages: request.messages.map((m) => ({ ...m })) });
    const turn = this.turns[this.callCount];
    this.callCount += 1;

    if (!turn) {
      throw new Error(
        `MockProvider exhausted: received ${this.callCount} calls but only ${this.turns.length} turns were scripted`,
      );
    }

    if ("error" in turn) {
      throw turn.error;
    }

    return {
      text: turn.text,
      usage: { ...DEFAULT_USAGE, ...turn.usage },
      model: this.model,
      stopReason: turn.stopReason ?? "end_turn",
    };
  }
}
