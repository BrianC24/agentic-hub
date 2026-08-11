# Evidence

Raw recordings backing the numbers in the root README and case study, so the
before/after is reproducible rather than asserted.

## `before-prompt-fix/`

Full workflow runs on `claude-haiku-4-5` where the planning stage returned step
`id` values as numbers instead of strings. The schema rejected every one and the
repair loop recovered each time — 4 model calls per run instead of 3.

Look at `exchanges[1].response.text` in any of these: the first planning attempt
contains `"id": 1`.

## `after-prompt-fix/`

The same three tickets after the planning prompt was changed to declare that
`id` is a string. The schema violation disappears; runs drop to 3 calls.

| | before | after |
|---|---|---|
| model calls | 4 | 3 |
| cost/run | $0.0247 | $0.0167 |
| latency | ~35s | ~28s |
| schema repair rate | 3/3 | 0/3 |
| rubric average | 4.20 | 4.53 |

## Reproducing

```bash
npx tsx scripts/revalidate-recordings.ts   # free, replays through current validators
LLM_PROVIDER=anthropic npx tsx scripts/run-evals.ts   # ~$0.15
```

Recordings are point-in-time. A prompt or schema change makes them stale by
design — that is what `revalidate-recordings.ts` is for.
