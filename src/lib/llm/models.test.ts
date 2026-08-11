import { describe, expect, it } from "vitest";
import {
  DEFAULT_SELECTABLE_MODEL,
  getSelectableModel,
  isSelectableModel,
  SELECTABLE_MODELS,
  resolveModel,
  unpricedSelectableModels,
} from "./models";

describe("selectable models", () => {
  it("rejects anything not on the allowlist", () => {
    // The security property: a request cannot name an arbitrary model and so
    // cannot pick the most expensive one available.
    expect(isSelectableModel("claude-opus-5")).toBe(true);
    expect(isSelectableModel("claude-fable-5")).toBe(false);
    expect(isSelectableModel("gpt-4")).toBe(false);
    expect(isSelectableModel("")).toBe(false);
    expect(isSelectableModel(null)).toBe(false);
    expect(isSelectableModel({ id: "claude-opus-5" })).toBe(false);
  });

  it("defaults to the cheapest option", () => {
    const costs = SELECTABLE_MODELS.map((m) => m.approxRunCostUsd);
    expect(getSelectableModel(DEFAULT_SELECTABLE_MODEL)?.approxRunCostUsd).toBe(Math.min(...costs));
  });

  it("prices every selectable model", () => {
    // An unpriced model would render its run cost as "unknown".
    expect(unpricedSelectableModels()).toEqual([]);
  });

  it("has unique ids", () => {
    const ids = SELECTABLE_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("resolveModel", () => {
  it("prefers an explicit request over configuration", () => {
    expect(resolveModel("claude-opus-5", "claude-haiku-4-5")).toBe("claude-opus-5");
  });

  it("falls back to the configured model when none is requested", () => {
    // Without this, ANTHROPIC_MODEL would govern the CLI scripts while the web
    // UI silently ignored it.
    expect(resolveModel(undefined, "claude-sonnet-5")).toBe("claude-sonnet-5");
  });

  it("ignores a configured model that is off the allowlist", () => {
    expect(resolveModel(undefined, "claude-fable-5")).toBe(DEFAULT_SELECTABLE_MODEL);
    expect(resolveModel(undefined, "typo-model")).toBe(DEFAULT_SELECTABLE_MODEL);
  });

  it("ignores a requested model that is off the allowlist", () => {
    expect(resolveModel("gpt-4", "claude-sonnet-5")).toBe("claude-sonnet-5");
  });

  it("falls back to the default when nothing is set", () => {
    expect(resolveModel(undefined, undefined)).toBe(DEFAULT_SELECTABLE_MODEL);
  });
});
