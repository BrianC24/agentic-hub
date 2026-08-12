/**
 * Provider-agnostic model interface.
 *
 * Everything the workflow needs from a model lives behind this interface so the
 * real Anthropic client can be swapped for a mock in tests. Nothing above this
 * layer imports a provider SDK.
 */

export type ModelRole = "user" | "assistant";

export interface ModelMessage {
  role: ModelRole;
  content: string;
}

export interface ModelRequest {
  system: string;
  messages: ModelMessage[];
  /** Hard ceiling on output. On thinking-enabled models this covers thinking + text. */
  maxTokens: number;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ModelResponse {
  /** Raw text. Untrusted, so always validate before use. */
  text: string;
  usage: ModelUsage;
  /** Model that actually served the response, which may differ from the one requested. */
  model: string;
  stopReason: string;
}

export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  complete(request: ModelRequest): Promise<ModelResponse>;
}

/** Thrown by a provider when the call itself fails (network, rate limit, refusal). */
export class ModelProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable: boolean }) {
    super(message);
    this.name = "ModelProviderError";
    this.retryable = options.retryable;
  }
}

export const EMPTY_USAGE: ModelUsage = { inputTokens: 0, outputTokens: 0 };

export function addUsage(a: ModelUsage, b: ModelUsage): ModelUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}
