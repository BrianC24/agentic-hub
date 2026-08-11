# Agentic Hub

An AI software-delivery harness: it takes a Jira-style engineering ticket and moves it through a visible, bounded workflow — intake, requirement extraction, planning, validation, evaluation, repair, human approval, run report.

The interesting part isn't the model call. It's everything around it: bounded loops, schema-validated outputs with a repair path, deterministic checks where correctness is objective, and per-run cost and latency you can actually inspect.

> **Status: in progress.** Stage 1 (ticket intake) is implemented end to end. Stage 2 (requirement extraction) exists as a tested library with a mock provider and a real Anthropic adapter, but is not yet wired to the UI. Stages 3–11 are not built. This README describes only what runs today.

## What works today

**Ticket intake** — an accessible form that validates a Jira-style ticket against a Zod schema before anything downstream runs. Malformed input fails here rather than three stages later. Three example tickets (clear, ambiguous, missing acceptance criteria) load from typed fixtures that double as eval cases.

**Requirement extraction (library only)** — a bounded agent loop that asks a model to extract explicit requirements, implied requirements, ambiguities, and missing information, then validates the response against a schema. On a schema violation it feeds the specific errors back to the model and retries, capped at two repairs. Every attempt records raw output, violations, token counts, latency, and estimated cost.

The loop is bounded three independent ways: a hard attempt ceiling, an exit as soon as output validates, and an immediate abort on a non-retryable provider error.

## Architecture

```
src/
  app/                      Next.js App Router pages
  components/
    ticket-intake/          Intake form
    workflow/               Stage rail
  lib/
    ticket/                 Ticket schema, form mapping, fixtures
    llm/                    Provider adapter (mock + Anthropic), pricing, config
    requirements/           Extraction schema, prompts, bounded repair loop
    workflow/               Stage definitions
scripts/
  record-extraction.ts      Records real runs as offline fixtures
```

Domain logic is kept out of React components, and no provider SDK is imported above the `lib/llm` adapter — so the model is swappable and mockable.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 46 tests
npm run lint
npm run build
```

No API key is needed for any of the above. `LLM_PROVIDER` defaults to `mock`, so tests and local development cannot make billable calls.

### Making real model calls

Real calls are opt-in and cost money.

1. Create a key at [console.anthropic.com](https://console.anthropic.com) and set a monthly spend limit on it. A Claude Pro/Max subscription does **not** include API access — API billing is separate.
2. `cp .env.example .env.local` and add the key.
3. `LLM_PROVIDER=anthropic npm run record`

Defaults to `claude-haiku-4-5` for iteration (roughly a tenth of a cent per call). Set `ANTHROPIC_MODEL=claude-opus-5` for runs whose numbers get published.

## Testing

Tests run against a scriptable mock provider, so every failure path is deterministic and free: valid first attempt, repair-then-succeed, retries exhausted, non-JSON output, provider errors, and cost/latency accumulation.

## Known limitations

- Stages 3–11 are unimplemented; the stage rail shows them as pending.
- Requirement extraction is not reachable from the UI yet.
- No persistence — runs are not stored.
- No eval harness yet; the ticket fixtures are the seed for one.
- Cost figures are estimates from published list prices, not billed amounts.

## AI-assisted development

Built with Claude Code assistance. Architecture decisions, tradeoffs, and review are my own; the repository, tests, and documentation are the evidence.
