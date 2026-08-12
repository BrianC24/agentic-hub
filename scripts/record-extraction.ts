/**
 * Runs requirement extraction against the real API and records the result.
 *
 * Recorded runs serve three purposes: they show how the model actually fails
 * (rather than how we guessed it would), they become high-fidelity offline
 * fixtures, and they back the replay-mode demo so the public deployment can run
 * without spending anything.
 *
 * Usage:
 *   LLM_PROVIDER=anthropic npx tsx scripts/record-extraction.ts [fixture-key]
 *
 * Costs real money. Defaults to claude-haiku-4-5 (~$0.001/run); override with
 * ANTHROPIC_MODEL=claude-opus-5 for a publishable run.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createAnthropicProvider, readLlmConfig } from "../src/lib/llm/config";

// Safe before any env read: config.ts only touches process.env inside functions.
loadEnv({ path: ".env.local", quiet: true });

import { extractRequirements } from "../src/lib/requirements/extract";
import { TICKET_FIXTURES, getTicketFixture } from "../src/lib/ticket/fixtures";

const RECORDINGS_DIR = path.join(process.cwd(), "recordings", "extraction");

async function main() {
  const config = readLlmConfig();
  if (config.provider !== "anthropic") {
    console.error(
      "Refusing to run: LLM_PROVIDER is not 'anthropic'.\n" +
        "This script makes real, billable API calls. Re-run with:\n\n" +
        "  LLM_PROVIDER=anthropic npx tsx scripts/record-extraction.ts\n",
    );
    process.exit(1);
  }

  const requestedKey = process.argv[2];
  const fixtures = requestedKey
    ? [getTicketFixture(requestedKey)].filter((f) => f !== undefined)
    : TICKET_FIXTURES;

  if (fixtures.length === 0) {
    console.error(
      `Unknown fixture "${requestedKey}". Available: ${TICKET_FIXTURES.map((f) => f.key).join(", ")}`,
    );
    process.exit(1);
  }

  const provider = createAnthropicProvider();
  console.log(`Model: ${config.model}`);
  console.log(`Fixtures: ${fixtures.length}\n`);

  await mkdir(RECORDINGS_DIR, { recursive: true });

  for (const fixture of fixtures) {
    process.stdout.write(`${fixture.key} … `);
    const run = await extractRequirements(provider, fixture.ticket);

    const cost =
      run.totalEstimatedCostUsd === null ? "unknown" : `$${run.totalEstimatedCostUsd.toFixed(4)}`;
    console.log(
      `${run.status}: ${run.attempts.length} attempt(s), ` +
        `${run.totalUsage.inputTokens}in/${run.totalUsage.outputTokens}out, ` +
        `${run.totalLatencyMs}ms, ${cost}`,
    );

    for (const attempt of run.attempts) {
      if (attempt.outcome !== "valid") {
        console.log(
          `    attempt ${attempt.attempt}: ${attempt.outcome}` +
            (attempt.violations.length > 0
              ? `: ${attempt.violations.map((v) => `${v.path}: ${v.message}`).join("; ")}`
              : "") +
            (attempt.providerError ? `: ${attempt.providerError}` : ""),
        );
      }
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(RECORDINGS_DIR, `${fixture.key}--${config.model}--${stamp}.json`);
    await writeFile(
      file,
      JSON.stringify({ fixtureKey: fixture.key, model: config.model, recordedAt: stamp, run }, null, 2),
      "utf8",
    );
    console.log(`    saved ${path.relative(process.cwd(), file)}\n`);
  }
}

main().catch((error) => {
  console.error("\nRecording failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
