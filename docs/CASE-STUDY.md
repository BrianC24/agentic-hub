# Case study: building an agent control plane

Written during construction, not reconstructed afterwards. Where a decision changed, the original reasoning is left in.

## Problem

Teams shipping AI features hit the same wall: the model works in the demo and is unreliable in production, and they have no systematic way to know *how* unreliable. The usual response is a better prompt, which addresses none of the actual failure modes.

The failures are structural, not linguistic:

- Output is prose when the system needs data.
- Plausible output passes review that correct output would also pass — the two are indistinguishable by reading.
- "Is this any good" has no answer without a rubric and a threshold.
- Nobody knows what a run cost, how often it retried, or which stage burned the tokens.

This project builds the layer that answers those questions, using ticket-to-implementation-plan as the setting because it is a workflow every engineer recognises.

## Goals and constraints

**Goal:** demonstrate a control plane — bounded loops, structured-output validation, deterministic and model-based evaluation, cost and latency tracing, human approval — with credible evidence that each part works.

**Constraints:**

- The core loop must be legible TypeScript, not hidden behind a framework. The concepts are the point; delegating them to LangChain would delete the thing being demonstrated.
- A public demo must not be able to spend money.
- No fabricated metrics. Every number published is measured, or it is not published.
- One complete vertical workflow beats eleven shallow stages.

## Architecture

Layered so that each concern can be tested without the one below it:

```
UI ────────────► API route ────────► orchestrator ────► stages ────► provider adapter
                 (replay/live)       (state machine)   (schema +     (mock | Anthropic
                                                        prompts)      | recording | replay)
```

**The provider adapter is the seam that makes everything else testable.** Nothing above `lib/llm` imports an SDK. Four implementations share one interface: a mock scripted turn-by-turn, the real Anthropic client, a decorator that records exchanges, and one that replays them. The workflow cannot tell them apart, which is what makes the offline demo genuine rather than a stub.

**The repair loop is generic.** Extraction, planning, and evaluation all need "call, validate, feed violations back, retry within a bound." That was written three times before being collapsed into `runStructured`, which each stage parameterises with its own prompts and parse function.

## Structured output validation

Every stage returns JSON validated against a Zod schema. That catches shape. It does not catch a well-formed lie, so two semantic rules were added on top:

**Verbatim quote checking.** Extraction must cite a `sourceQuote` for every explicit requirement, and that quote must actually appear in the ticket. Comparison collapses whitespace and ignores case, so a quote spanning a line break still passes; anything looser stops catching invention, which is the point.

**Requirement id checking.** A plan step may only cite requirement ids that exist. Without it, a model can manufacture coverage by inventing ids — the plan passes the coverage check and is hollow.

Both are failure classes that constrained decoding cannot catch, because the output is structurally perfect. That is the argument for having a repair loop at all.

## Deterministic vs. model-based evaluation

The rule applied throughout: **if it is objectively decidable, decide it in code.**

Requirement coverage is set arithmetic. Whether a test strategy exists is a length check. Whether every risk has a mitigation is a filter. Sending these to a model judge would be slower, more expensive, and occasionally wrong about computable facts.

What is left genuinely needs judgement: is the approach sound, does it invent constraints, would the tests catch a real regression, does it stay in scope, does it name the risks that matter. Those get a rubric with anchored 1–5 scores, mandatory evidence per score, and a 3.5 threshold.

Checks run **before** the judge. A plan already known to be short should not cost an evaluation call.

One design decision worth naming: the judge must score every criterion exactly once. Without that rule a model can silently omit the criterion it would score badly, and the average improves for free — structurally valid, semantically dishonest, and invisible unless you check.

## What the real runs changed

Everything up to this point was built against a mock whose responses I had *guessed*. The first live run invalidated part of that guess immediately.

**Finding 1: the repair loop fires, and my prompt was why.** In 3 of 3 runs, planning returned step ids as numbers rather than strings. The loop behaved exactly as designed — violations fed back, retry succeeded — but the honest reading is that the prompt declared the field without its type and invited the error. Fixing the prompt removed an entire model call per run: −25% calls, −32% cost, −20% latency, and rubric scores went *up* (4.20 → 4.53).

The tempting alternative was to coerce numbers to strings in the schema. That would have hidden the defect and kept paying for the extra call forever.

**Finding 2: `clarificationNeeded` cannot be trusted as a gate.** It came back `true` for all three fixtures, including the well-specified one, so the first conclusion was "the model over-flags." A later recording set had it discriminate correctly, which makes the real property nondeterminism rather than bias — see the code-review section below for how that conclusion had to be revised. Explicit-requirement count is used as the discriminator instead, and nothing gates on the flag.

**Finding 3: an assertion that passed vacuously.** The coverage assertion checked that the requirement-coverage check "did not fail" — which is trivially true on a run that never reached validation. It now requires the check to have run *and* passed. An eval that passes when nothing ran is worse than no eval.

**Finding 4: replan rate is not a stable number.** Two consecutive full eval runs each had exactly one replan, but on *different* cases. Quoting a single run's replan rate as a property of the system would be wrong.

## What a code review found

Reviewing the finished tree turned up three defects, two of which were
invisible from the outside.

**A spend vector in the approval path.** The decision endpoint cast client
input rather than validating it, and enforced the repair bound against a
number the caller supplied. A forged run with `repairRounds: -9999` was
accepted and made real billable calls — which falsified this project's own
claim that no path runs unbounded. The instructive part is that the obvious
fix is insufficient: validating the shape still lets a client send
`repairRounds: 0` on every request. The state had to move server-side, with
the caller holding only an opaque id.

**Corrupted recordings.** Both providers stored request objects by reference
while the repair loop mutates a single `messages` array in place, so every
recorded exchange showed the *final* conversation rather than what was sent at
that point. Replay still worked, because only responses are replayed — which
is exactly why it went unnoticed. It had quietly corrupted the request side of
the published evidence.

**A blank stage rail.** `complete` is not a stage on the rail, so approving a
run made every stage render as pending — the progress indicator emptied at the
precise moment the user finished.

Re-recording after the fixes also corrected a finding: `clarificationNeeded`
turned out to be nondeterministic rather than reliably over-flagging. The
earlier conclusion had treated a single sample as a property, which is the
error this document warns about two sections above. Writing that warning did
not prevent me from making it.

## Failure recovery

Two mechanisms, deliberately distinguished because conflating them hides what is happening:

| | Schema repair | Replan |
|---|---|---|
| Trigger | Malformed model output | Well-formed output rejected on merits |
| Feedback | The specific validation errors | Failed checks, or weak rubric criteria with evidence |
| Bound | 2 repairs per stage | 2 rounds per run |

Every loop is bounded three ways: attempt ceiling, early exit on success, and immediate abort on a non-retryable provider error. Retryable provider errors deliberately do *not* consume repair budget — transport retry is a different concern with its own backoff policy, and spending schema-repair budget on a rate limit would be wrong.

Writing the orchestrator surfaced a missing transition: failed deterministic checks had no path back to planning. The state machine threw rather than letting a run into an impossible state, which is the entire argument for modelling transitions as data instead of scattering booleans.

## Human approval

The workflow stops at `awaiting_approval` and does not complete itself. Rejection is modelled as a loop back to planning, not a terminal failure — a rejected plan is feedback, not the end of the run.

The decision is recorded for the session only. There is no persistence, and the UI says so rather than implying otherwise.

## Observability, cost, and latency

Every attempt records raw output, violations, tokens, latency, and estimated cost. The run report shows per-stage traces and calls out repaired stages rather than smoothing them over.

Cost estimation returns `null` for an unpriced model rather than `0`, so an unknown cost renders as "unknown" and can never be mistaken for free.

Full eval suite: 7 cases, 23 model calls, ~240s, $0.148 on Haiku. Roughly 10× that on Opus.

## Approaches rejected

**Constrained decoding for structured output.** Would eliminate shape violations — and would also have eliminated the repair loop, which is the thing worth demonstrating. More substantively, it cannot catch the semantic failures (fabricated quotes, invented ids) that motivated the loop in the first place. Worth adding later as an optimisation *alongside* the loop, not instead of it.

**An LLM judge for requirement coverage.** Rejected on principle. It is set arithmetic.

**Building all eleven stages.** Explicitly against the project's own scope-control rules. Eleven shallow stages would demonstrate less than one complete vertical slice with real evals.

**Coercing numeric step ids.** Would have hidden a prompt defect and paid for it on every run.

## Known limitations

It plans work, it does not write code — no repository access, no execution, no PR. Runs are not persisted. Tested on one model family. The rubric threshold is uncalibrated against human raters. Seven eval cases catch gross regressions, not fine quality differences. Replay covers three tickets. Cost figures are list-price estimates, not billed amounts.

## What would change at production scale

Durable run state so a run survives a restart. A sandboxed executor and repository access so plans become diffs. Per-tenant isolation and rate limits. The eval suite gating prompt changes in CI against a tracked pass-rate baseline, since a prompt change is a behaviour change. Budget enforcement before the call rather than measurement after. Human-calibrated rubric scoring, without which the threshold is a guess with a decimal point.

## Lessons

**The mock was a hypothesis, not a test.** Everything built against it was provisional until the first real call, which invalidated part of it within one run. Building nine stages before making that call would have meant refactoring nine stages.

**Evals find bugs in the evals.** Three of the four findings above are defects in my own assertions and assumptions, not in the model. That is normal and it is the reason to write them.

**Fix the cause, not the symptom.** The repair loop successfully papered over a prompt defect. Working recovery made a fixable problem invisible until the trace was actually read.

**Distinguish your failure modes.** "Retry" covered two mechanisms with different triggers, feedback, and bounds. Naming them separately made the system explicable and the reporting honest.
