import { describe, expect, it } from "vitest";
import { getTicketFixture } from "@/lib/ticket/fixtures";
import { runWorkflow } from "@/lib/workflow/orchestrator";
import { createReplayProvider, listRecordedFixtures, RECORDING_BY_FIXTURE } from "./index";

/**
 * These are the project's highest-value tests: they run the real workflow over
 * real captured model output. A change that breaks the pipeline against actual
 * responses fails here, where a hand-written mock would have kept passing.
 */
describe("replayed workflows", () => {
  it("has a recording for every shipped fixture", () => {
    expect(listRecordedFixtures().sort()).toEqual(
      ["ambiguous-ticket", "clear-feature-request", "missing-acceptance-criteria"].sort(),
    );
  });

  for (const fixtureKey of ["clear-feature-request", "ambiguous-ticket", "missing-acceptance-criteria"]) {
    it(`reaches the approval gate for ${fixtureKey}`, async () => {
      const fixture = getTicketFixture(fixtureKey);
      expect(fixture).toBeDefined();

      const provider = createReplayProvider(fixtureKey);
      const result = await runWorkflow(provider, fixture!.ticket);

      expect(result.run.stage).toBe("awaiting_approval");
      expect(result.artifacts.requirements).not.toBeNull();
      expect(result.artifacts.plan).not.toBeNull();
      expect(result.artifacts.validation?.passed).toBe(true);
      expect(result.artifacts.evaluation?.passed).toBe(true);
    });
  }

  it("recomputes the same totals the live run produced", async () => {
    const fixture = getTicketFixture("clear-feature-request")!;
    const recording = RECORDING_BY_FIXTURE["clear-feature-request"];

    const result = await runWorkflow(createReplayProvider("clear-feature-request"), fixture.ticket);

    expect(result.totals.modelCalls).toBe(recording.expected.modelCalls);
    expect(result.run.stage).toBe(recording.expected.stage);
  });

  it("extracts more explicit requirements from a well-specified ticket", async () => {
    const clear = await runWorkflow(
      createReplayProvider("clear-feature-request"),
      getTicketFixture("clear-feature-request")!.ticket,
    );
    const ambiguous = await runWorkflow(
      createReplayProvider("ambiguous-ticket"),
      getTicketFixture("ambiguous-ticket")!.ticket,
    );

    // Explicit-requirement count tracks the acceptance criteria actually
    // present, so it discriminates. clarificationNeeded does not — see below.
    expect(clear.artifacts.requirements!.explicitRequirements.length).toBeGreaterThan(
      ambiguous.artifacts.requirements!.explicitRequirements.length,
    );
    expect(ambiguous.artifacts.requirements!.ambiguities.length).toBeGreaterThan(0);
  });

  it("documents that clarificationNeeded over-flags and cannot gate on its own", async () => {
    // Measured limitation on claude-haiku-4-5: every fixture came back true,
    // including the well-specified one. Pinned as a test so a future prompt
    // change that fixes it fails loudly here rather than going unnoticed.
    const results = await Promise.all(
      ["clear-feature-request", "ambiguous-ticket", "missing-acceptance-criteria"].map((key) =>
        runWorkflow(createReplayProvider(key), getTicketFixture(key)!.ticket),
      ),
    );

    expect(results.map((r) => r.artifacts.requirements!.clarificationNeeded)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("fails loudly when a recording runs out mid-workflow", async () => {
    const provider = createReplayProvider("clear-feature-request");
    await provider.complete();
    await provider.complete();
    await provider.complete();

    // A silent empty response here would look like a model failure and send a
    // debugging session down the wrong path.
    await expect(provider.complete()).rejects.toThrow(/exhausted/i);
  });
});
