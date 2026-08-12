# Agentic Hub

An AI software-delivery harness. It takes a Jira-style engineering ticket and moves it through a bounded, inspectable workflow — requirement extraction, implementation planning, deterministic validation, rubric-based evaluation, and a human approval gate — recording every model call's tokens, latency, and cost.

The model call is not the interesting part. The interesting part is everything that decides whether to trust it.

> **Status.** The vertical workflow runs end to end. What is *not* built is stated plainly in [Known limitations](#known-limitations) — most importantly, this plans work, it does not write code.

## Why a single prompt is not enough

You can ask a model to "read this ticket and write an implementation plan" in one call, and it will produce something plausible. Four things go wrong at that point, and none of them are fixed by a better prompt:

1. **The output is prose, not data.** Anything downstream has to parse it, and parsing fails in ways you only discover in production.
2. **Plausible is not correct.** A plan can cite a requirement the ticket never contained, and nothing catches it — the text reads fine.
3. **You cannot tell a good run from a bad one.** Without a rubric and a threshold, "is this plan any good" is a vibe.
4. **You have no idea what it cost.** Or how often it retried, or which stage burned the tokens.

This project is the layer that answers those. Concretely: every stage returns schema-validated structured output; citations are checked against the ticket's own words; objective properties are checked in code and only genuine judgement calls go to a model judge; and every attempt is traced with its tokens, latency, and cost.

## The workflow

```
Ticket
  │
  ├─ intake ............ Zod-validated. Malformed input fails here, not three stages later.
  │
  ├─ requirements ...... Explicit + implied requirements, ambiguities, missing info.
  │                      Every cited quote must appear verbatim in the ticket.
  │
  ├─ planning .......... Steps, files, test strategy, risks, out-of-scope.
  │                      Each step cites the requirement ids it satisfies.
  │
  ├─ validation ........ Deterministic checks. Free, objective, run before any judge.
  │                      ── fail ──► back to planning (bounded)
  │
  ├─ evaluation ........ Rubric judge, 1–5 with evidence per criterion.
  │                      ── below threshold ──► back to planning (bounded)
  │
  └─ awaiting_approval . Stops. A human decides.
```

Two distinct repair mechanisms operate here, and conflating them hides what is actually happening:

- **Schema repair** — the model returned malformed output. The specific validation errors are fed back and it retries, bounded at 2 repairs per stage.
- **Replan** — the output was well-formed but rejected on its merits by the checks or the judge. The plan is regenerated with the specific reasons attached, bounded at 2 rounds.

Every loop is bounded three independent ways: a hard attempt ceiling, an exit as soon as output validates, and an immediate abort on a non-retryable provider error. There is no path that runs unbounded.

## Measured results

All figures from `claude-haiku-4-5`, recorded 2026-08-11. Cost is estimated from published list prices, not billed amounts. Raw runs are in [`docs/evidence/`](docs/evidence/).

**Eval suite — 7/7 cases pass, $0.148, ~240s total**

| Case | Calls | Replans | Latency | Cost |
|---|---|---|---|---|
| clear-feature-request | 3 | 0 | 32.3s | $0.0202 |
| ambiguous-ticket | 3 | 0 | 28.0s | $0.0173 |
| missing-acceptance-criteria | 3 | 0 | 26.2s | $0.0155 |
| conflicting-requirements | 3 | 0 | 30.7s | $0.0193 |
| overly-broad-scope | 3 | 0 | 41.1s | $0.0276 |
| security-sensitive | 3 | 0 | 29.8s | $0.0185 |
| prompt-injection | 5 | 1 | 49.4s | $0.0298 |

Replan rate is **not** stable across runs. On the previous run a different case needed the replan. It is reported as observed rather than as a fixed property.

**A prompt defect the evals caught.** The first live runs failed schema validation in 3 of 3 cases, always the same way: planning returned step ids as numbers rather than strings. The repair loop worked — it fed the violations back and the retry succeeded — but the real fault was a prompt that declared the field without its type. Adding six words fixed it:

| | Before | After |
|---|---|---|
| Model calls | 4 | 3 |
| Cost per run | $0.0247 | $0.0167 |
| Latency | ~35s | ~28s |
| Schema repair rate | 3/3 | 0/3 |
| Rubric average | 4.20 | 4.53 |

Both sets of recordings are kept so the before/after is reproducible rather than asserted.

**Cost across models.** Same ticket, one full run each:

| Model | Calls | Output tokens | Latency | Cost | Rubric |
|---|---|---|---|---|---|
| Haiku 4.5 | 3 | ~2,800 | ~28s | $0.017 | 4.4 |
| Sonnet 5 | 3 | 4,204 | 45.1s | $0.075 | 4.4 |
| Opus 5 | 3 | 7,558 | 97.7s | $0.220 | 4.4 |

Opus is 5x Haiku per token but **13x per run**, because thinking is on by
default and inflates output. On this ticket all three scored the same rubric
average, so the extra spend bought no measurable quality — which is the kind of
thing you only learn by measuring it.

**A false assumption the evals caught — twice.** `clarificationNeeded` first came back `true` for every fixture, including the well-specified one, so it looked like a reliable over-flagger. A later recording set had it discriminate correctly. It is a nondeterministic model judgement, not a signal, and nothing gates on it. The first version of that finding treated one sample as a property — the exact error the case study warns about.

## Deterministic vs. model-based evaluation

The split is deliberate: **anything objectively decidable is decided in code.** A model judge asked to re-answer these would be slower, more expensive, and occasionally wrong about facts that are simply computable.

**Deterministic** (`src/lib/validation/checks.ts`) — every explicit requirement is addressed by some step; a test strategy exists; steps trace to a requirement; risks carry mitigations; raised ambiguities surface in the plan. Requirement coverage is set arithmetic, which is exactly why plan steps carry requirement ids.

**Model-based** (`src/lib/evaluation/`) — approach soundness, unsupported assumptions, test-strategy quality, scope discipline, risk awareness. Each is scored 1–5 against written anchors, each score must carry evidence quoting the plan, and the threshold is 3.5. The judge must score every criterion exactly once — silently skipping the one it would score badly raises the average.

Stated limitations of the judge are in `src/lib/evaluation/rubric.ts`: it judges the plan rather than the implementation, shares a model family with the planner, is uncalibrated against human raters, and has no repository context.

## Security

**Ticket text is untrusted input.** The eval suite includes a prompt injection in a ticket body (`IGNORE ALL PREVIOUS INSTRUCTIONS…`); the assertion is that the harness still produces a real plan and that the injected marker never appears in output. It passes, though one adversarial case is evidence, not a guarantee.

**Model output is untrusted input.** Nothing downstream reads a field that has not passed a schema. Beyond shape, two semantic rules catch dishonest-but-well-formed output: a cited quote must appear verbatim in the ticket, and a plan step may only cite requirement ids that exist. Constrained decoding would not catch either.

**The deployment cannot be made to spend money.** `LLM_PROVIDER` defaults to `mock`. A request may *ask* for live mode, but it is served a replay — escalation is impossible from the client side, and this is covered by tests rather than asserted.

**A run's state is server-side.** An earlier version had the client post the whole run back when making an approval decision, which meant the repair bound was checked against a number the caller controlled: a forged run with `repairRounds: -9999` was accepted and made real billable calls. Validating the shape would not have fixed it, since a client sending `repairRounds: 0` forever still buys unlimited replans. Runs now live in a bounded, expiring server-side store and the caller holds only an unguessable id.

**Secrets.** Keys live in `.env.local` (gitignored); `.env.example` documents the variables with no values.

## Deploying

Deploy with **no environment variables** and it runs replay-only: the genuine
workflow against recorded responses, unable to make a billable call regardless
of what a request asks for. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # full suite
npm run lint
npm run build
```

No API key needed. The app runs in replay mode against real recorded responses — the genuine workflow with only the transport swapped, so the orchestrator, validators, state machine, and scoring all execute for real.

### Live model calls

Optional, and costs money.

1. Create a key at [console.anthropic.com](https://console.anthropic.com). **Turn off auto-reload** and buy a small credit balance — that balance is then a hard ceiling. A Claude Pro/Max subscription does **not** include API access.
2. `cp .env.example .env.local`, add the key.
3. `LLM_PROVIDER=anthropic npm run dev`, then tick "Live model calls".

Scripts:

```bash
LLM_PROVIDER=anthropic npx tsx scripts/record-workflow.ts   # record runs (~$0.02 each)
LLM_PROVIDER=anthropic npx tsx scripts/run-evals.ts         # eval suite (~$0.15)
npx tsx scripts/revalidate-recordings.ts                    # replay through current validators, free
```

## Architecture

```
src/
  app/
    api/run/           Run endpoint; decides replay vs live, never escalates
  components/
    ticket-intake/     Intake form
    workflow/          Stage rail, run report, approval gate
  lib/
    llm/               Provider adapter (mock, Anthropic, recording, replay),
                       the bounded repair loop, pricing
    ticket/            Ticket schema and fixtures
    requirements/      Extraction schema, prompts, verbatim-quote rule
    planning/          Plan schema, prompts, requirement-id rule
    validation/        Deterministic checks
    evaluation/        Rubric, judge schema, scoring
    workflow/          State machine and orchestrator
    evals/             Eval cases and runner
    replay/            Committed recordings for the offline demo
scripts/               Recording, eval, and revalidation CLIs
```

No provider SDK is imported above `lib/llm`, so the model is swappable and mockable. Domain logic is kept out of React components.

## Testing

The most valuable tests replay real captured model output through the real workflow — a change that breaks the pipeline against actual responses fails there, where a hand-written mock would happily keep passing.

Failure paths are covered as first-class cases: schema violations and repair, exhausted retry budgets, non-retryable provider errors, non-JSON output, code-fence-wrapped JSON, illegal state transitions, exhausted recordings, and eval cases that produce no output at all.

## Known limitations

- **It plans work; it does not write code.** There is no repository access, no execution, no PR.
- **No persistence.** Runs live in memory; the approval decision is recorded for the session only, and the UI says so.
- **Model comparison is one ticket deep.** Haiku, Sonnet, and Opus were each run once on the same ticket and scored identically. That is a data point, not a finding — the eval suite runs only on Haiku.
- **The judge is uncalibrated.** The 3.5 threshold is a starting point, not validated against human raters.
- **Small eval set.** Seven cases is enough to catch gross regressions, not to measure quality precisely.
- **Replay covers three tickets.** Any other ticket needs live mode.
- **Cost figures are estimates** from list prices, not billed amounts.

## What would change at production scale

Durable run state so a run survives a restart; a sandboxed executor and repository access so plans become diffs; per-tenant isolation and rate limits; the eval suite gating prompt changes in CI with a tracked pass-rate baseline; budget enforcement *before* the call rather than measurement after; and human-calibrated rubric scoring.

## AI-assisted development

Built with Claude Code assistance. The architecture decisions, the tradeoffs, and the review are mine; the repository, the evals, and this document are the evidence.
