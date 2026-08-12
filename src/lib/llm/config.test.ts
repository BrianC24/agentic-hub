import { describe, expect, it } from "vitest";
import { createAnthropicProvider, DEV_MODEL, MissingApiKeyError, readLlmConfig } from "./config";

describe("readLlmConfig", () => {
  it("defaults to the mock provider so nothing spends money by accident", () => {
    expect(readLlmConfig({}).provider).toBe("mock");
  });

  it("only opts into the real API on an exact match", () => {
    expect(readLlmConfig({ LLM_PROVIDER: "anthropic" }).provider).toBe("anthropic");
    expect(readLlmConfig({ LLM_PROVIDER: "Anthropic" }).provider).toBe("mock");
    expect(readLlmConfig({ LLM_PROVIDER: "real" }).provider).toBe("mock");
  });

  it("defaults to the cheap dev model", () => {
    expect(readLlmConfig({}).model).toBe(DEV_MODEL);
  });

  it("honours a model override and ignores a blank one", () => {
    expect(readLlmConfig({ ANTHROPIC_MODEL: "claude-opus-5" }).model).toBe("claude-opus-5");
    expect(readLlmConfig({ ANTHROPIC_MODEL: "   " }).model).toBe(DEV_MODEL);
  });
});

describe("createAnthropicProvider", () => {
  it("throws a directive error when the key is missing", () => {
    expect(() => createAnthropicProvider({ LLM_PROVIDER: "anthropic" })).toThrow(
      MissingApiKeyError,
    );
  });

  it("builds a provider when a key is present", () => {
    const provider = createAnthropicProvider({
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-ant-test",
      ANTHROPIC_MODEL: "claude-opus-5",
    });
    expect(provider.name).toBe("anthropic");
    expect(provider.model).toBe("claude-opus-5");
  });
});

describe("configWarnings", () => {
  it("explains a misspelled provider instead of failing silently", async () => {
    const { configWarnings } = await import("./config");
    const warnings = configWarnings({ LLM_PROVIDER: "Anthropic" });

    // The exact mistake that made a live deployment silently stay in mock.
    expect(warnings[0]).toMatch(/not recognised/i);
    expect(warnings[0]).toContain("Anthropic");
  });

  it("flags an enabled provider with no key", async () => {
    const { configWarnings } = await import("./config");
    expect(configWarnings({ LLM_PROVIDER: "anthropic" })[0]).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("flags a model that is not on the allowlist", async () => {
    const { configWarnings } = await import("./config");
    const warnings = configWarnings({
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-ant-test",
      ANTHROPIC_MODEL: "claude-fable-5",
    });
    expect(warnings[0]).toMatch(/allowlist/i);
  });

  it("never echoes the key", async () => {
    const { configWarnings } = await import("./config");
    const warnings = configWarnings({ LLM_PROVIDER: "nope", ANTHROPIC_API_KEY: "sk-ant-secret" });
    expect(warnings.join(" ")).not.toContain("sk-ant-secret");
  });

  it("says nothing when configuration is coherent", async () => {
    const { configWarnings } = await import("./config");
    expect(configWarnings({ LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-test" })).toEqual([]);
    expect(configWarnings({})).toEqual([]);
  });
});
