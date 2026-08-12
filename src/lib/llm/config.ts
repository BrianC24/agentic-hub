import { AnthropicProvider } from "./anthropic-provider";
import { isSelectableModel } from "./models";
import type { ModelProvider } from "./types";

/**
 * Model defaults.
 *
 * Haiku is the dev default on purpose: iterating on a prompt costs roughly a
 * tenth of a cent per call there. Switch to `claude-opus-5` for the recorded
 * runs whose numbers end up in the README.
 */
export const DEV_MODEL = "claude-haiku-4-5";
export const PRODUCTION_MODEL = "claude-opus-5";

export type ProviderKind = "mock" | "anthropic";

export interface LlmConfig {
  provider: ProviderKind;
  model: string;
}

/**
 * Exactly the environment this module reads. Narrower than NodeJS.ProcessEnv so
 * callers (and tests) can pass a literal, and so the contract is self-documenting.
 */
export interface LlmEnv {
  LLM_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  /** Present so `process.env` is assignable; the named keys above are the contract. */
  [key: string]: string | undefined;
}

/**
 * Reads provider config from the environment.
 *
 * Defaults to `mock` so that running the app, the tests, or a fresh clone
 * cannot spend money. Reaching the real API is an explicit opt-in.
 */
export function readLlmConfig(env: LlmEnv = process.env): LlmConfig {
  const provider = env.LLM_PROVIDER === "anthropic" ? "anthropic" : "mock";
  return {
    provider,
    model: env.ANTHROPIC_MODEL?.trim() || DEV_MODEL,
  };
}

/**
 * Explains why live mode is off, when the configuration suggests it was meant
 * to be on.
 *
 * Falling back to mock is the safe default, but doing it silently turns a
 * one-character mistake into an unexplained deployment. Each message says what
 * was seen and what to change; none of them echo the key.
 */
export function configWarnings(env: LlmEnv = process.env): string[] {
  const warnings: string[] = [];
  const raw = env.LLM_PROVIDER;

  if (raw !== undefined && raw !== "mock" && raw !== "anthropic") {
    warnings.push(
      `LLM_PROVIDER is "${raw}", which is not recognised. Expected exactly "anthropic" (lowercase) or "mock". Falling back to mock, so live calls are disabled.`,
    );
  }

  if (raw === "anthropic" && !env.ANTHROPIC_API_KEY?.trim()) {
    warnings.push("LLM_PROVIDER is anthropic but ANTHROPIC_API_KEY is empty or unset.");
  }

  const model = env.ANTHROPIC_MODEL?.trim();
  if (model && !isSelectableModel(model)) {
    warnings.push(
      `ANTHROPIC_MODEL is "${model}", which is not on the allowlist, so the default will be used instead.`,
    );
  }

  return warnings;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY. Add it to .env.local (see .env.example), or unset LLM_PROVIDER to stay on the mock provider.",
    );
    this.name = "MissingApiKeyError";
  }
}

/**
 * Builds the real provider. Throws a directive error rather than a raw SDK
 * failure when the key is absent, since that is the most likely setup mistake.
 */
export function createAnthropicProvider(
  env: LlmEnv = process.env,
  modelOverride?: string,
): ModelProvider {
  const { model: configuredModel } = readLlmConfig(env);
  // Callers may override the model, but the API route only passes values that
  // cleared the allowlist. An unvalidated string must never reach here.
  const model = modelOverride ?? configuredModel;
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingApiKeyError();
  }
  return new AnthropicProvider({ model, apiKey });
}
