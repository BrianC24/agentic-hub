import { describe, expect, it } from "vitest";
import {
  DEFAULT_SELECTABLE_MODEL,
  getSelectableModel,
  isSelectableModel,
  SELECTABLE_MODELS,
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
