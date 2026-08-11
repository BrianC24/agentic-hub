import Anthropic from "@anthropic-ai/sdk";
import {
  ModelProviderError,
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
} from "./types";

export interface AnthropicProviderOptions {
  model: string;
  apiKey?: string;
  /** Injectable for tests, so the mapping logic can be exercised without network. */
  client?: Anthropic;
}

/**
 * Real Anthropic adapter.
 *
 * Deliberately thin: it maps our provider-agnostic request/response shape onto
 * the SDK and classifies errors. No prompt construction, no retry logic, no
 * validation — those belong to the workflow, not the transport.
 */
export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";
  readonly model: string;

  private readonly apiKey?: string;
  private client: Anthropic | undefined;

  constructor(options: AnthropicProviderOptions) {
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.client = options.client;
  }

  /**
   * Built on first use, not in the constructor: the SDK throws when it cannot
   * resolve a key, and constructing at module load would crash the app for
   * anyone running without one — including a fresh clone of the repo.
   */
  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic(this.apiKey ? { apiKey: this.apiKey } : {});
    }
    return this.client;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    let message: Anthropic.Message;
    try {
      message = await this.getClient().messages.create({
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        // `thinking` is intentionally unset. Its valid shape differs by model
        // (adaptive on Opus 5, budget_tokens on Haiku 4.5), and sending the
        // wrong one is a 400. Each model's default is correct for extraction.
      });
    } catch (error) {
      throw toProviderError(error);
    }

    // Safety classifiers can decline with a successful HTTP 200. Check this
    // before reading content — on a refusal, content is empty or partial.
    if (message.stop_reason === "refusal") {
      throw new ModelProviderError(
        `Model refused the request${
          message.stop_details && "category" in message.stop_details
            ? ` (${String(message.stop_details.category)})`
            : ""
        }`,
        { retryable: false },
      );
    }

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
      // The serving model can differ from the one requested (fallbacks).
      model: message.model,
      stopReason: message.stop_reason ?? "unknown",
    };
  }
}

/**
 * Maps SDK errors onto our transport-agnostic error, classifying whether a
 * retry could plausibly succeed. The repair loop reads `retryable` to decide
 * whether to abort immediately or let a backoff policy handle it.
 */
export function toProviderError(error: unknown): ModelProviderError {
  if (error instanceof Anthropic.RateLimitError) {
    return new ModelProviderError(`Rate limited: ${error.message}`, { retryable: true });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ModelProviderError(`Connection failed: ${error.message}`, { retryable: true });
  }
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    return new ModelProviderError(`Anthropic API error ${status}: ${error.message}`, {
      retryable: status >= 500,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ModelProviderError(message, { retryable: false });
}
