import { ReplayProvider, type RecordedExchange } from "@/lib/llm/recording-provider";
import ambiguousTicket from "./recordings/ambiguous-ticket.json";
import clearFeatureRequest from "./recordings/clear-feature-request.json";
import missingAcceptanceCriteria from "./recordings/missing-acceptance-criteria.json";

/**
 * Replay mode.
 *
 * The recordings are real responses captured from claude-haiku-4-5. Replaying
 * them runs the genuine workflow, with the same orchestrator, validators, state
 * machine, and scoring, and only the transport swapped, so a public demo
 * costs nothing and needs no API key.
 *
 * Derived artefacts are deliberately not stored: the workflow recomputes
 * requirements, checks, and scores from the raw responses, so a replay
 * exercises the real code rather than replaying cached conclusions.
 */

export interface Recording {
  fixtureKey: string;
  model: string;
  recordedAt: string;
  exchanges: RecordedExchange[];
  expected: {
    stage: string;
    modelCalls: number;
    estimatedCostUsd: number | null;
  };
}

const RECORDINGS = [
  clearFeatureRequest,
  ambiguousTicket,
  missingAcceptanceCriteria,
] as unknown as Recording[];

export const RECORDING_BY_FIXTURE: Record<string, Recording> = Object.fromEntries(
  RECORDINGS.map((r) => [r.fixtureKey, r]),
);

export function hasRecording(fixtureKey: string): boolean {
  return fixtureKey in RECORDING_BY_FIXTURE;
}

export function listRecordedFixtures(): string[] {
  return Object.keys(RECORDING_BY_FIXTURE);
}

/** Builds a provider that replays the recording for one fixture. */
export function createReplayProvider(fixtureKey: string): ReplayProvider {
  const recording = RECORDING_BY_FIXTURE[fixtureKey];
  if (!recording) {
    throw new Error(
      `No recording for fixture "${fixtureKey}". Available: ${listRecordedFixtures().join(", ")}`,
    );
  }
  return new ReplayProvider(recording.exchanges, recording.model);
}
