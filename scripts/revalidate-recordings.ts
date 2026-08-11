/**
 * Replays saved recordings through the current validator.
 *
 * Free — no model calls. Run this after tightening a schema to see whether
 * previously-passing model output would still pass, without paying to find out.
 *
 * Usage: npx tsx scripts/revalidate-recordings.ts
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { buildQuotableText, parseExtraction } from "../src/lib/requirements/schema";
import { getTicketFixture } from "../src/lib/ticket/fixtures";

const RECORDINGS_DIR = path.join(process.cwd(), "recordings", "extraction");

async function main() {
  let files: string[];
  try {
    files = (await readdir(RECORDINGS_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    console.log("No recordings yet. Run `npm run record` first.");
    return;
  }

  let passed = 0;
  let failed = 0;

  for (const file of files.sort()) {
    const record = JSON.parse(await readFile(path.join(RECORDINGS_DIR, file), "utf8"));
    const fixture = getTicketFixture(record.fixtureKey);
    if (!fixture) {
      console.log(`SKIP  ${file} — unknown fixture "${record.fixtureKey}"`);
      continue;
    }

    const raw = record.run?.attempts?.[0]?.raw;
    if (typeof raw !== "string") {
      console.log(`SKIP  ${file} — no raw output recorded`);
      continue;
    }

    const result = parseExtraction(raw, buildQuotableText(fixture.ticket));
    if (result.success) {
      passed += 1;
      console.log(`PASS  ${record.fixtureKey} (${record.model})`);
    } else {
      failed += 1;
      console.log(`FAIL  ${record.fixtureKey} (${record.model}) — ${result.violations.length} violation(s)`);
      for (const violation of result.violations) {
        console.log(`        ${violation.path}: ${violation.message}`);
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed across ${passed + failed} recording(s).`);
}

main().catch((error) => {
  console.error("Revalidation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
