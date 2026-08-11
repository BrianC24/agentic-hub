import { describe, expect, it } from "vitest";
import type { ImplementationPlan } from "@/lib/planning/schema";
import type { ExtractedRequirements } from "@/lib/requirements/schema";
import { formatFailedChecks, validatePlan } from "./checks";

const requirements: ExtractedRequirements = {
  summary: "Add CSV export.",
  explicitRequirements: [
    { id: "R1", text: "Export button", sourceQuote: "Export CSV button" },
    { id: "R2", text: "Respect filter", sourceQuote: "respects the active filter" },
  ],
  impliedRequirements: [{ id: "I1", text: "Escape commas" }],
  ambiguities: [{ question: "Which timezone?", why: "Changes output" }],
  missingInformation: [],
  clarificationNeeded: false,
};

const plan: ImplementationPlan = {
  approach: "Add an export endpoint and a button.",
  steps: [
    { id: "S1", description: "Add button", addressesRequirements: ["R1"], files: ["Toolbar.tsx"] },
    { id: "S2", description: "Apply filter", addressesRequirements: ["R2"], files: ["export.ts"] },
  ],
  testStrategy: ["Unit test the CSV serializer"],
  risks: [{ description: "Large exports time out", mitigation: "Stream the response" }],
  outOfScope: ["Scheduled exports"],
};

function statusOf(report: ReturnType<typeof validatePlan>, id: string) {
  return report.results.find((r) => r.id === id)?.status;
}

describe("validatePlan", () => {
  it("passes a complete plan", () => {
    const report = validatePlan(plan, requirements);
    expect(report.passed).toBe(true);
    expect(report.failedCount).toBe(0);
  });

  it("fails when an explicit requirement is not addressed", () => {
    const partial = { ...plan, steps: [plan.steps[0]] };
    const report = validatePlan(partial, requirements);

    expect(report.passed).toBe(false);
    expect(statusOf(report, "requirement-coverage")).toBe("fail");
    expect(
      report.results.find((r) => r.id === "requirement-coverage")?.detail,
    ).toContain("R2");
  });

  it("fails when there is no test strategy", () => {
    const report = validatePlan({ ...plan, testStrategy: [] }, requirements);
    expect(statusOf(report, "test-strategy")).toBe("fail");
    expect(report.passed).toBe(false);
  });

  it("warns rather than fails on a step that traces to nothing", () => {
    const withOrphan: ImplementationPlan = {
      ...plan,
      steps: [
        ...plan.steps,
        { id: "S3", description: "Refactor unrelated module", addressesRequirements: [], files: [] },
      ],
    };
    const report = validatePlan(withOrphan, requirements);

    expect(statusOf(report, "orphan-steps")).toBe("warn");
    // Warnings are judgement calls for the human; they do not block.
    expect(report.passed).toBe(true);
    expect(report.warnedCount).toBeGreaterThan(0);
  });

  it("warns when ambiguities were raised but the plan lists no risks", () => {
    const report = validatePlan({ ...plan, risks: [] }, requirements);
    expect(statusOf(report, "ambiguities-acknowledged")).toBe("warn");
  });

  it("treats coverage as vacuous when nothing explicit was extracted", () => {
    const report = validatePlan(plan, { ...requirements, explicitRequirements: [] });
    expect(statusOf(report, "requirement-coverage")).toBe("warn");
  });

  it("fails a risk with no mitigation", () => {
    const report = validatePlan(
      { ...plan, risks: [{ description: "Data loss", mitigation: "   " }] },
      requirements,
    );
    expect(statusOf(report, "risks-mitigated")).toBe("fail");
  });

  it("formats only failures for the repair prompt", () => {
    const report = validatePlan({ ...plan, testStrategy: [], steps: [plan.steps[0]] }, requirements);
    const text = formatFailedChecks(report);

    expect(text).toContain("verified");
    expect(text).toContain("R2");
    // Warnings must not appear — they are not what the repair should chase.
    expect(text).not.toContain("traces back");
  });
});
