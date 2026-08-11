import { describe, expect, it } from "vitest";
import { estimateCostUsd, formatCostUsd, sumCostUsd } from "./cost";

describe("estimateCostUsd", () => {
  it("prices a known model from real token counts", () => {
    // 1M input @ $5 + 1M output @ $25 = $30
    const cost = estimateCostUsd("claude-opus-5", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(30);
  });

  it("scales linearly below a million tokens", () => {
    const cost = estimateCostUsd("claude-opus-5", { inputTokens: 10_000, outputTokens: 2_000 });
    // 0.01 * 5 + 0.002 * 25 = 0.05 + 0.05
    expect(cost).toBeCloseTo(0.1);
  });

  it("returns null for an unpriced model rather than guessing zero", () => {
    expect(estimateCostUsd("some-future-model", { inputTokens: 100, outputTokens: 100 })).toBeNull();
  });
});

describe("sumCostUsd", () => {
  it("adds known costs", () => {
    expect(sumCostUsd([0.5, 0.25])).toBeCloseTo(0.75);
  });

  it("propagates null when any cost is unknown", () => {
    expect(sumCostUsd([0.5, null])).toBeNull();
  });
});

describe("formatCostUsd", () => {
  it("distinguishes unknown from zero", () => {
    expect(formatCostUsd(null)).toBe("unknown");
    expect(formatCostUsd(0)).toBe("$0.00");
  });

  it("marks sub-cent costs rather than rounding them to zero", () => {
    expect(formatCostUsd(0.004)).toBe("<$0.01");
  });
});
