import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StageRail } from "./StageRail";
import type { RunStage } from "@/lib/workflow/run";

function classesFor(stage: RunStage): string[] {
  const { container } = render(<StageRail activeStage={stage} />);
  return Array.from(container.querySelectorAll("li")).map((li) => li.className);
}

describe("StageRail", () => {
  it("marks the current stage and everything before it", () => {
    const classes = classesFor("validation");
    // intake, requirements, planning done; validation active; rest pending.
    expect(classes.filter((c) => c.includes("complete"))).toHaveLength(3);
    expect(classes.filter((c) => c.includes("active"))).toHaveLength(1);
  });

  it("shows every stage complete once the run is approved", () => {
    // Without this, approving a run blanked the rail: `complete` is not a rail
    // stage, so findIndex returned -1 and nothing rendered as done.
    const classes = classesFor("complete");
    expect(classes.filter((c) => c.includes("complete"))).toHaveLength(classes.length);
    expect(classes.some((c) => c.includes("active"))).toBe(false);
  });

  it("marks nothing on a failed run, which has no position on the rail", () => {
    const classes = classesFor("failed");
    expect(classes.some((c) => c.includes("complete") || c.includes("active"))).toBe(false);
  });

  it("marks the first stage active at intake", () => {
    const { container } = render(<StageRail activeStage="intake" />);
    const first = container.querySelector("li");
    expect(first?.getAttribute("aria-current")).toBe("step");
  });
});
