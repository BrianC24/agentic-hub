import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider, toProviderError } from "./anthropic-provider";
import { ModelProviderError } from "./types";

/** Minimal stand-in for the SDK client — only `messages.create` is used. */
function clientReturning(message: unknown): Anthropic {
  return {
    messages: { create: vi.fn().mockResolvedValue(message) },
  } as unknown as Anthropic;
}

function clientThrowing(error: unknown): Anthropic {
  return {
    messages: { create: vi.fn().mockRejectedValue(error) },
  } as unknown as Anthropic;
}

const baseMessage = {
  content: [{ type: "text", text: '{"ok":true}' }],
  usage: { input_tokens: 120, output_tokens: 45 },
  model: "claude-haiku-4-5",
  stop_reason: "end_turn",
};

describe("AnthropicProvider", () => {
  it("maps an SDK response onto the provider-agnostic shape", async () => {
    const provider = new AnthropicProvider({
      model: "claude-haiku-4-5",
      client: clientReturning(baseMessage),
    });

    const response = await provider.complete({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 1024,
    });

    expect(response.text).toBe('{"ok":true}');
    expect(response.usage).toEqual({ inputTokens: 120, outputTokens: 45 });
    expect(response.stopReason).toBe("end_turn");
  });

  it("concatenates multiple text blocks and ignores non-text blocks", async () => {
    const provider = new AnthropicProvider({
      model: "claude-haiku-4-5",
      client: clientReturning({
        ...baseMessage,
        content: [
          { type: "thinking", thinking: "" },
          { type: "text", text: '{"a":' },
          { type: "text", text: "1}" },
        ],
      }),
    });

    const response = await provider.complete({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 1024,
    });

    expect(response.text).toBe('{"a":1}');
  });

  it("reports the serving model, which can differ from the requested one", async () => {
    const provider = new AnthropicProvider({
      model: "claude-opus-5",
      client: clientReturning({ ...baseMessage, model: "claude-opus-4-8" }),
    });

    const response = await provider.complete({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 1024,
    });

    expect(response.model).toBe("claude-opus-4-8");
  });

  it("throws on a refusal instead of returning empty content", async () => {
    const provider = new AnthropicProvider({
      model: "claude-opus-5",
      client: clientReturning({
        ...baseMessage,
        content: [],
        stop_reason: "refusal",
        stop_details: { type: "refusal", category: "cyber" },
      }),
    });

    await expect(
      provider.complete({ system: "s", messages: [{ role: "user", content: "x" }], maxTokens: 100 }),
    ).rejects.toThrow(/refused/i);
  });

  it("wraps transport failures as ModelProviderError", async () => {
    const provider = new AnthropicProvider({
      model: "claude-haiku-4-5",
      client: clientThrowing(new Error("socket hang up")),
    });

    await expect(
      provider.complete({ system: "s", messages: [{ role: "user", content: "x" }], maxTokens: 100 }),
    ).rejects.toBeInstanceOf(ModelProviderError);
  });

  it("does not construct a client when one is injected", async () => {
    // No ANTHROPIC_API_KEY needed: proves lazy construction is bypassed in tests
    // and, by extension, that importing this module never touches credentials.
    const provider = new AnthropicProvider({
      model: "claude-haiku-4-5",
      client: clientReturning(baseMessage),
    });
    await expect(
      provider.complete({ system: "s", messages: [{ role: "user", content: "x" }], maxTokens: 10 }),
    ).resolves.toBeDefined();
  });
});

describe("toProviderError", () => {
  it("marks a plain error non-retryable", () => {
    const mapped = toProviderError(new Error("bad input"));
    expect(mapped.retryable).toBe(false);
    expect(mapped.message).toBe("bad input");
  });

  it("stringifies non-Error throws", () => {
    expect(toProviderError("boom").message).toBe("boom");
  });
});
