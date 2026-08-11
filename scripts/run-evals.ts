/**
 * Runs the eval suite against the real API.
 *
 * Every meaningful prompt or workflow change should be run through this, and
 * regressions reported rather than favourable cases cherry-picked.
 *
 * Usage:
 *   LLM_PROVIDER=anthropic npx tsx scripts/run-evals.ts [case-key]
 *
 * Costs real money — roughly $0.02 per case on claude-haiku-4-5.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createAnthropicProvider, readLlmConfig } from "../src/lib/llm/config";
import { EVAL_CASES } from "../src/lib/evals/cases";
import { formatEvalReport, runEvals } from "../src/lib/evals/runner";

loadEnv({ path: ".env.local", quiet: true });

const RESULTS_DIR = path.join(process.cwd(), "recordings", "evals");

async function main() {
  const config = readLlmConfig();
  if (config.provider !== "anthropic") {
    console.error(
      "Refusing to run: LLM_PROVIDER is not 'anthropic'.\n" +
        "This script makes real, billable API calls. Re-run with:\n\n" +
        "  LLM_PROVIDER=anthropic npx tsx scripts/run-evals.ts\n",
    );
    process.exit(1);
  }

  const requestedKey = process.argv[2];
  const cases = requestedKey ? EVAL_CASES.filter((c) => c.key === requestedKey) : EVAL_CASES;

  if (cases.length === 0) {
    console.error(
      `Unknown case "${requestedKey}". Available: ${EVAL_CASES.map((c) => c.key).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`Model: ${config.model}`);
  console.log(`Cases: ${cases.length}`);
  console.log(`Estimated cost: ~$${(cases.length * 0.02).toFixed(2)}\n`);

  const report = await runEvals(() => createAnthropicProvider(), cases);
  console.log(formatEvalReport(report));

  await mkdir(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(RESULTS_DIR, `evals--${config.model}--${stamp}.json`);
  await writeFile(file, JSON.stringify({ model: config.model, recordedAt: stamp, report }, null, 2), "utf8");
  console.log(`\nSaved ${path.relative(process.cwd(), file)}`);

  // Non-zero exit on regression, so this can gate CI later.
  if (report.passedCases < report.totalCases) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nEval run failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
