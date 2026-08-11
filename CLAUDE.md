# CLAUDE.md

## Purpose

This repository is a portfolio project designed to help Brian Canlas earn a senior software-engineering role focused on frontend engineering, AI-powered products, agentic workflows, developer tooling, or frontend-heavy full-stack development.

The project must demonstrate production-quality engineering and genuine understanding of AI systems. It is not a generic chatbot, a tutorial clone, or a collection of AI-generated features.

## Developer Context

Brian is a Senior Frontend Engineer with 7+ years of professional experience. His strongest technologies are JavaScript, TypeScript, React, Next.js, Redux, Node.js, HTML, CSS, and modern frontend architecture.

Relevant professional experience includes:

- Building scalable user-facing applications and reusable component systems.
- Owning features from requirements through production.
- Working across product, design, backend, and QA.
- Building an AI-powered Agent Assist Chrome extension with real-time guidance, conversation summaries, and Salesforce integration.
- Contributing to an AI Knowledge Graph and agentic workflow platform.
- Using LaunchDarkly, Datadog, Amplitude, AWS, Salesforce, and Chrome Extensions in production.
- Using LLM-assisted workflows for planning, implementation, debugging, and testing.

The target positioning is:

> Senior Frontend Engineer | AI Products & Agentic Workflows

The target job search prioritizes remote senior frontend, senior product engineering, frontend-heavy full-stack, AI product, AI platform frontend, developer-experience, and AI tooling roles.

## Product Direction

The working product is an AI software-delivery harness and evaluation platform. It should accept a Jira-style engineering ticket and move it through a visible, controlled workflow such as:

1. Ticket intake
2. Requirement extraction
3. Clarification or escalation
4. Repository/context analysis
5. Implementation planning
6. Implementation or simulated implementation
7. Deterministic validation
8. LLM-based evaluation
9. Repair loop
10. Human approval
11. Final run report

The interface should make agent behavior inspectable. Users should be able to understand what happened, why it happened, what failed, what was retried, and what the run cost.

## Primary Engineering Goals

Prioritize work that demonstrates:

- Strong React and TypeScript architecture
- Clear agent loops and bounded execution
- Explicit tool definitions and permissions
- Structured model outputs with runtime validation
- Deterministic and probabilistic evaluation
- Human-in-the-loop approval
- Failure handling, retries, and resumable execution
- Traceability of prompts, tool calls, state transitions, latency, and cost
- Security-conscious handling of secrets and untrusted input
- Accessible, responsive, production-quality UI
- Clear technical tradeoffs that Brian can explain in an interview

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
2. Prefer the simplest architecture that demonstrates the target engineering concept.
3. Keep domain logic separate from React components and provider-specific API code.
4. Use strict TypeScript. Avoid `any`; when unavoidable, explain and isolate it.
5. Validate all external and model-generated data at runtime.
6. Treat model output as untrusted input.
7. Make workflow states and transitions explicit rather than encoding them in scattered booleans.
8. Bound all agent loops with maximum iterations, timeouts, and clear exit conditions.
9. Give tools narrow permissions and explicit input/output contracts.
10. Keep model-provider integrations behind a small adapter so models can be changed or mocked.
11. Never expose secrets to the client, logs, commits, fixtures, screenshots, or documentation.
12. Do not silently add packages. Explain why a dependency is justified before adding it.
13. Do not rewrite unrelated code or perform broad refactors without a demonstrated need.
14. Preserve existing behavior unless the task explicitly changes it.
15. Do not claim a feature works until the relevant checks have run successfully.

### Framework policy

The core agent harness should be implemented in understandable TypeScript/Node.js code.

- Do not hide the main agent loop, state machine, context selection, retries, permissions, or evaluation logic behind LangChain, CrewAI, or another large agent framework.
- A focused library may be used when it removes commodity work without hiding the concepts this project exists to demonstrate.
- If proposing a framework, compare it against a lightweight custom implementation and explain the tradeoff first.

### UI policy

The UI is a major part of the portfolio evidence, not an afterthought.

- Build accessible semantic interfaces with keyboard support and visible focus states.
- Design for loading, empty, partial, success, and failure states.
- Display workflow status, agent decisions, tool calls, eval results, latency, token usage, and estimated cost clearly.
- Prefer an inspectable workflow dashboard over a chat-only interface.
- Keep components focused and reusable without creating abstractions prematurely.
- Avoid generic AI visual clichés, excessive gradients, and decorative complexity that does not improve comprehension.
- Ensure the application works at common mobile and desktop widths.

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

Each LLM evaluator must have:

- A specific rubric
- A structured result schema
- A score with a clear meaning
- Written evidence or reasoning tied to the evaluated output
- A defined passing threshold
- Known limitations

Do not let an LLM judge replace an objective assertion that could be implemented deterministically.

### Eval dataset

Maintain version-controlled eval cases in JSON, JSONL, YAML, or typed fixtures. Include normal and adversarial cases such as:

- Clear feature request
- Ambiguous ticket
- Missing acceptance criteria
- Conflicting requirements
- Overly broad scope
- Accessibility regression
- Security-sensitive request
- Request requiring clarification
- Request requiring refusal or human escalation

Every meaningful prompt, workflow, or model change should be evaluated against the existing set. Report regressions instead of selecting only favorable examples.

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

## Documentation and Portfolio Evidence

Every major feature should strengthen the public case study and interview story.

Maintain documentation that explains:

- The user problem
- Architecture and data flow
- Agent loop and workflow states
- Tool contracts and permission boundaries
- Context-selection strategy
- Deterministic versus probabilistic eval choices
- Failure modes and recovery behavior
- Security considerations
- Cost and latency tradeoffs
- Alternatives considered and why they were rejected
- Known limitations and the next production-scale improvement

Prefer diagrams and concrete examples when they clarify behavior. Avoid marketing language and unsupported claims.

For each completed milestone, provide a concise summary that Brian could adapt into:

- A resume project bullet
- A GitHub README update
- A LinkedIn build post
- A system-design interview explanation

Do not fabricate metrics. Track real measurements such as eval pass rate, latency, token usage, estimated cost, failure rate, or bundle size before citing them.

## Scope Control

The goal is a deployed, explainable portfolio project—not an endless platform.

Prioritize in this order:

1. One complete vertical workflow
2. Reliable state and structured outputs
3. Deterministic validation
4. A small credible eval dataset
5. Failure and repair behavior
6. Workflow observability UI
7. Deployment and documentation
8. Additional providers or advanced features

When a request risks overengineering:

- Explain the cost.
- Propose the smallest version that preserves the learning and portfolio value.
- Separate MVP work from later enhancements.

Do not spend time on authentication, billing, multi-tenancy, elaborate infrastructure, or a large design system unless they are required for the public demo or target engineering story.

## Collaboration Style

- Be direct and evidence-based.
- Challenge weak assumptions instead of agreeing automatically.
- Explain decisions in plain language.
- Lead with the outcome, then the relevant reasoning.
- Keep plans concise and actionable.
- Teach the underlying concept when implementing agent loops, context management, tool calling, evals, or recovery logic so Brian can explain it without relying on generated code.
- When generating code, identify the important parts Brian should personally review and understand.
- Never present AI-generated implementation as proof of understanding by itself; the repository, evals, documentation, and Brian's explanations must demonstrate that understanding.

## Definition of Done

A task is complete only when:

- The requested behavior is implemented.
- The implementation follows existing repository conventions.
- Types and external inputs are appropriately validated.
- Relevant tests and project checks pass.
- Important failure paths are handled.
- Documentation is updated when architecture or behavior changed.
- The final response summarizes changes, verification, tradeoffs, and remaining limitations.
- The result contributes credible evidence toward Brian's target senior engineering roles.
