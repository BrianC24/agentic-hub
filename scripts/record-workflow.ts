/**
 * Runs the full workflow against the real API and records everything.
 *
 * Recordings become offline fixtures, the replay-mode demo's data, and the
 * source of the real numbers quoted in the README.
 *
 * Usage:
 *   LLM_PROVIDER=anthropic npx tsx scripts/record-workflow.ts [fixture-key]
 *
 * Costs real money. Defaults to claude-haiku-4-5.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createAnthropicProvider, readLlmConfig } from "../src/lib/llm/config";
import { RecordingProvider } from "../src/lib/llm/recording-provider";
import { TICKET_FIXTURES } from "../src/lib/ticket/fixtures";
import { runWorkflow } from "../src/lib/workflow/orchestrator";

loadEnv({ path: ".env.local", quiet: true });

const RECORDINGS_DIR = path.join(process.cwd(), "recordings", "workflow");

async function main() {
  const config = readLlmConfig();
  if (config.provider !== "anthropic") {
    console.error(
      "Refusing to run: LLM_PROVIDER is not 'anthropic'.\n" +
        "This script makes real, billable API calls. Re-run with:\n\n" +
        "  LLM_PROVIDER=anthropic npx tsx scripts/record-workflow.ts\n",
    );
    process.exit(1);
  }

  const requestedKey = process.argv[2];
  const fixtures = requestedKey
    ? TICKET_FIXTURES.filter((f) => f.key === requestedKey)
    : TICKET_FIXTURES;

  if (fixtures.length === 0) {
    console.error(
      `Unknown fixture "${requestedKey}". Available: ${TICKET_FIXTURES.map((f) => f.key).join(", ")}`,
    );
    process.exit(1);
  }

  await mkdir(RECORDINGS_DIR, { recursive: true });
  console.log(`Model: ${config.model}\nFixtures: ${fixtures.length}\n`);

  let grandTotal = 0;

  for (const fixture of fixtures) {
    process.stdout.write(`${fixture.key} …\n`);
    const recorder = new RecordingProvider(createAnthropicProvider());
    const result = await runWorkflow(recorder, fixture.ticket);

    const cost = result.totals.estimatedCostUsd;
    grandTotal += cost ?? 0;

    console.log(`  stage: ${result.run.stage}`);
    console.log(
      `  ${result.totals.modelCalls} model call(s), ` +
        `${result.totals.usage.inputTokens}in/${result.totals.usage.outputTokens}out, ` +
        `${result.totals.latencyMs}ms, ${cost === null ? "unknown" : `$${cost.toFixed(4)}`}`,
    );
    if (result.artifacts.validation) {
      console.log(
        `  checks: ${result.artifacts.validation.failedCount} failed, ${result.artifacts.validation.warnedCount} warned`,
      );
    }
    if (result.artifacts.evaluation) {
      console.log(
        `  rubric: ${result.artifacts.evaluation.averageScore.toFixed(2)} (${result.artifacts.evaluation.passed ? "pass" : "fail"})`,
      );
    }
    for (const stageRun of result.artifacts.stageRuns) {
      if (stageRun.attempts > 1 || stageRun.status === "failed") {
        console.log(
          `  ! ${stageRun.stage} round ${stageRun.round}: ${stageRun.attempts} attempt(s), ${stageRun.status}` +
            (stageRun.violations.length
              ? `: ${stageRun.violations.map((v) => `${v.path}: ${v.message}`).join("; ")}`
              : ""),
        );
      }
    }
    if (result.run.failureReason) {
      console.log(`  failure: ${result.run.failureReason}`);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(RECORDINGS_DIR, `${fixture.key}--${config.model}--${stamp}.json`);
    await writeFile(
      file,
      JSON.stringify(
        {
          fixtureKey: fixture.key,
          model: config.model,
          recordedAt: stamp,
          exchanges: recorder.exchanges,
          run: result.run,
          artifacts: result.artifacts,
          totals: result.totals,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`  saved ${path.relative(process.cwd(), file)}\n`);
  }

  console.log(`Total this session: $${grandTotal.toFixed(4)}`);
}

main().catch((error) => {
  console.error("\nRecording failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
