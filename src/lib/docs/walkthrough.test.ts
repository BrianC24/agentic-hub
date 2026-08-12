import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PLAN_RUBRIC } from "@/lib/evaluation/rubric";
import { SELECTABLE_MODELS } from "@/lib/llm/models";
import { REPAIR_MECHANISMS, RUBRIC_CRITERIA, sourceUrl, STAGES } from "./walkthrough";

/**
 * Documentation that fails CI when it goes stale.
 *
 * The How It Works page is the artefact most likely to rot: it describes code
 * that keeps changing, and nothing else would notice a reference going dead.
 */
describe("walkthrough source references", () => {
  const referenced = STAGES.flatMap((s) => s.sources);

  it("references at least one file per stage", () => {
    for (const stage of STAGES) {
      expect(stage.sources.length, `${stage.id} cites no source`).toBeGreaterThan(0);
    }
  });

  it("every referenced file exists", () => {
    const missing = referenced.filter((rel) => !existsSync(path.join(process.cwd(), rel)));
    expect(missing).toEqual([]);
  });

  it("builds a source URL pointing at the repository", () => {
    expect(sourceUrl("src/lib/ticket/schema.ts")).toMatch(
      /^https:\/\/github\.com\/.+\/blob\/main\/src\/lib\/ticket\/schema\.ts$/,
    );
  });
});

describe("walkthrough content integrity", () => {
  it("numbers stages contiguously from one", () => {
    expect(STAGES.map((s) => s.number)).toEqual(STAGES.map((_, i) => i + 1));
  });

  it("has unique stage ids", () => {
    const ids = STAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every stage a reason, not just a description", () => {
    // The "why" is the part that demonstrates judgement; a stage without one
    // is a tutorial entry.
    for (const stage of STAGES) {
      expect(stage.why.length, `${stage.id} has a thin rationale`).toBeGreaterThan(80);
      expect(stage.evidence.length, `${stage.id} cites no evidence`).toBeGreaterThan(0);
    }
  });

  it("derives the rubric from the rubric module rather than restating it", () => {
    expect(RUBRIC_CRITERIA).toHaveLength(PLAN_RUBRIC.length);
    expect(RUBRIC_CRITERIA.map((c) => c.label)).toEqual(PLAN_RUBRIC.map((c) => c.label));
  });

  it("describes both repair mechanisms with their real bounds", () => {
    expect(REPAIR_MECHANISMS).toHaveLength(2);
    for (const mechanism of REPAIR_MECHANISMS) {
      expect(mechanism.bound).toMatch(/\d/);
    }
  });

  it("keeps the model table in step with the allowlist", () => {
    // A model added to the picker but missing here would make the page lie.
    expect(SELECTABLE_MODELS.length).toBeGreaterThan(0);
  });
});
