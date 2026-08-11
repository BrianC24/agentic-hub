@CLAUDE.private.md

# CLAUDE.md

## Purpose

This repository is an AI software-delivery harness and evaluation platform. It accepts a Jira-style engineering ticket and moves it through a visible, controlled workflow — ticket intake, requirement extraction, clarification/escalation, repository analysis, planning, implementation, deterministic validation, LLM-based evaluation, repair loop, human approval, and a final run report.

The project must demonstrate production-quality engineering and genuine understanding of AI systems. It is not a generic chatbot, a tutorial clone, or a collection of AI-generated features. The interface should make agent behavior inspectable — what happened, why, what failed, what was retried, and what the run cost.

## Architecture Principles

- Keep domain logic separate from React components and provider-specific API code.
- Make workflow states and transitions explicit rather than encoding them in scattered booleans.
- Keep model-provider integrations behind a small adapter so models can be changed or mocked.
- Give tools narrow permissions and explicit input/output contracts.
- Prefer the simplest architecture that demonstrates the target engineering concept.
- Do not rewrite unrelated code or perform broad refactors without a demonstrated need.
- Preserve existing behavior unless the task explicitly changes it.

### Framework policy

The core agent harness should be implemented in understandable TypeScript/Node.js code.

- Do not hide the main agent loop, state machine, context selection, retries, permissions, or evaluation logic behind LangChain, CrewAI, or another large agent framework.
- A focused library may be used when it removes commodity work without hiding the concepts this project exists to demonstrate.
- If proposing a framework, compare it against a lightweight custom implementation and explain the tradeoff first.

## TypeScript and React Standards

- Use strict TypeScript. Avoid `any`; when unavoidable, explain and isolate it.
- Validate all external and model-generated data at runtime.
- Keep components focused and reusable without creating abstractions prematurely.
- Build accessible semantic interfaces with keyboard support and visible focus states.
- Design for loading, empty, partial, success, and failure states.
- Ensure the application works at common mobile and desktop widths.
- Avoid generic AI visual clichés, excessive gradients, and decorative complexity that does not improve comprehension.
- Do not silently add packages. Explain why a dependency is justified before adding it.

## Agent Workflow and State-Machine Rules

- Bound all agent loops with maximum iterations, timeouts, and clear exit conditions.
- Treat model output as untrusted input.
- Display workflow status, agent decisions, tool calls, eval results, latency, token usage, and estimated cost clearly.
- Prefer an inspectable workflow dashboard over a chat-only interface.

## Structured Output Validation

- All model-generated structured output must be validated at runtime against a schema before use.
- Never expose secrets to the client, logs, commits, fixtures, screenshots, or documentation.

## Evaluation Requirements

Evaluation is a first-class product feature.

### Deterministic checks

Use deterministic checks where correctness can be objectively verified, including:

- Schema validity
- Required-field coverage
- Type checking
- Linting
- Unit and integration tests
- Build success
- Tool permission enforcement
- Loop and timeout limits
- Expected files or structured artifacts

### Probabilistic checks

Use rubric-based LLM evaluation only where judgment is actually required, including:

- Requirement coverage
- Unsupported assumptions
- Plan completeness
- Test-strategy quality
- Correct clarification or escalation
- Security and accessibility awareness

Each LLM evaluator must have a specific rubric, a structured result schema, a score with a clear meaning, written evidence tied to the evaluated output, a defined passing threshold, and known limitations.

Do not let an LLM judge replace an objective assertion that could be implemented deterministically.

### Eval dataset

Maintain version-controlled eval cases in JSON, JSONL, YAML, or typed fixtures. Include normal and adversarial cases: clear feature request, ambiguous ticket, missing acceptance criteria, conflicting requirements, overly broad scope, accessibility regression, security-sensitive request, request requiring clarification, request requiring refusal or human escalation.

Every meaningful prompt, workflow, or model change should be evaluated against the existing set. Report regressions instead of selecting only favorable examples.

## Bounded Retries and Human Approval

- Failure handling, retries, and resumable execution are core to the workflow, not an edge case.
- Retries must be bounded and their limits visible in the workflow UI.
- Human-in-the-loop approval gates must be implemented where the workflow crosses from proposal to action.

## Testing and Verification

Before declaring a task complete:

1. Identify the repository's actual validation commands from `package.json` and project documentation.
2. Run the narrowest relevant tests during implementation.
3. Run applicable lint, typecheck, test, and build commands before final completion.
4. Test failure paths, not only the happy path.
5. For UI work, verify loading, empty, error, and responsive states.
6. For workflow changes, verify maximum-iteration behavior, retries, invalid structured output, provider failure, and interrupted execution.
7. Report exactly what was run and disclose anything that could not be verified.

Never invent test results or imply that an unrun command passed.

## Security

- Security-conscious handling of secrets and untrusted input is required throughout.
- Never expose API keys or credentials to the client, logs, commits, fixtures, screenshots, or documentation.
- Treat all model output and external input as untrusted.

## Observability, Cost, and Latency

- Traceability of prompts, tool calls, state transitions, latency, and cost is a primary product feature, not an add-on.
- Track real measurements (eval pass rate, latency, token usage, estimated cost, failure rate, bundle size) before citing them anywhere. Do not fabricate metrics.

## Documentation Requirements

Maintain documentation that explains: the user problem; architecture and data flow; agent loop and workflow states; tool contracts and permission boundaries; context-selection strategy; deterministic versus probabilistic eval choices; failure modes and recovery behavior; security considerations; cost and latency tradeoffs; alternatives considered and why they were rejected; known limitations and the next production-scale improvement.

Prefer diagrams and concrete examples when they clarify behavior. Avoid marketing language and unsupported claims.

## Public-Release Safety Rules

Before this repository is made public:

- Remove API keys, credentials, personal information, employer information, and proprietary material.
- Inspect the full Git history for accidentally committed secrets.
- Never include employer code, data, prompts, tickets, internal architecture, or confidential workflows.
- Use fictional companies, users, tickets, and datasets.
- Commit `.env.example`; never commit `.env`.
- Ensure a new developer can run the project by following the README.
- Remove abandoned experiments, generated clutter, and unused dependencies.
- Include an appropriate license.
- Keep commit messages understandable and intentional.
- Do not publish unverifiable claims or invented performance metrics.
- Disclose that Claude Code assisted development without implying that Claude independently designed or owns the project.

Do not make the repository public automatically. Prepare it for publication and present a final safety checklist for human approval.

## Scope Control

Prioritize work in this order:

1. One complete vertical workflow.
2. Reliable state and structured outputs.
3. Deterministic validation.
4. A small credible eval dataset.
5. Failure and repair behavior.
6. Workflow observability UI.
7. Product usability and visual polish.
8. Documentation.
9. Deployment and showcase assets.
10. Additional providers or advanced features.

When a request risks overengineering: explain the cost, propose the smallest version that preserves the learning value, and separate MVP work from later enhancements.

Do not delay the core workflow to build authentication, teams, billing, multi-tenancy, complex infrastructure, or a large design system unless required for the demo.

## Operating Rules

### Before implementing

1. Inspect the repository, `package.json`, existing documentation, tests, and current conventions.
2. Do not assume libraries, commands, architecture, or infrastructure that the repository does not contain.
3. Restate the requested outcome and identify affected areas.
4. For nontrivial changes, produce a short plan with independently verifiable steps.
5. Call out unclear requirements, security implications, and important tradeoffs before coding.
6. Ask a question only when the missing answer would materially change the implementation. Otherwise, state the smallest reasonable assumption and proceed.

### While implementing

1. Work in small, reviewable increments.
2. Do not claim a feature works until the relevant checks have run successfully.

## Collaboration Style

- Be direct and evidence-based.
- Challenge weak assumptions instead of agreeing automatically.
- Explain decisions in plain language.
- Lead with the outcome, then the relevant reasoning.
- Keep plans concise and actionable.
- Teach the underlying concept when implementing agent loops, context management, tool calling, evals, or recovery logic.
- When generating code, identify the important parts that should be personally reviewed and understood.
- Never present AI-generated implementation as proof of understanding by itself; the repository, evals, documentation, and independent explanation must demonstrate that understanding.

## Definition of Done

A task is complete only when:

- The requested behavior is implemented.
- The implementation follows existing repository conventions.
- Types and external inputs are appropriately validated.
- Relevant tests and project checks pass.
- Important failure paths are handled.
- Documentation is updated when architecture or behavior changed.
- The final response summarizes changes, verification, tradeoffs, and remaining limitations.

The project as a whole is release-ready only when:

- One complete vertical workflow works end to end.
- The primary interface is polished and usable.
- Model responses are schema-validated.
- Deterministic checks and model-based evaluations both exist.
- At least one failed evaluation and repair path can be demonstrated.
- Retries are bounded.
- Human approval is implemented where appropriate.
- Run history records workflow steps, failures, latency, and estimated cost.
- Tests cover the primary path and meaningful failure paths.
- The application is deployed safely.
- A replayable example works without uncontrolled API spending.
- The repository passes the public-release safety checklist.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
