import { PLAN_RUBRIC, PASSING_THRESHOLD, EVALUATOR_LIMITATIONS } from "@/lib/evaluation/rubric";
import { SELECTABLE_MODELS } from "@/lib/llm/models";
import { DEFAULT_MAX_REPAIRS } from "@/lib/llm/structured";
import { MAX_REPAIR_ROUNDS } from "@/lib/workflow/run";

/**
 * Content for the How It Works page.
 *
 * Numbers are imported from the modules that define them rather than written
 * out, so the page cannot drift from the code. `walkthrough.test.ts` asserts
 * every referenced source file exists, which makes a stale reference a failing
 * test rather than something a reader discovers.
 */

const REPO = "https://github.com/BrianC24/agentic-hub/blob/main";

export function sourceUrl(path: string): string {
  return `${REPO}/${path}`;
}

export interface WalkthroughStage {
  id: string;
  number: number;
  title: string;
  /** One line: what this stage produces. */
  what: string;
  /** The failure it is designed to prevent. This is the interesting part. */
  why: string;
  /** Source files, checked for existence by the test suite. */
  sources: string[];
  /** Measured or verifiable facts. No claim here is aspirational. */
  evidence: string[];
}

export const STAGES: WalkthroughStage[] = [
  {
    id: "intake",
    number: 1,
    title: "Ticket intake",
    what: "Validates a Jira-style ticket against a Zod schema before anything else runs.",
    why: "Malformed input should fail at the boundary, not three stages and two model calls later. Acceptance criteria are deliberately optional — a ticket without them is incomplete, not invalid, and naming that gap is a later stage's job rather than something to reject here.",
    sources: ["src/lib/ticket/schema.ts", "src/components/ticket-intake/TicketIntakeForm.tsx"],
    evidence: [
      "Rejects a ticket with an unknown priority, a missing title, or a non-object body.",
      "The same schema validates the API request, so the HTTP boundary and the UI cannot disagree.",
    ],
  },
  {
    id: "requirements",
    number: 2,
    title: "Requirement extraction",
    what: "Turns prose into explicit requirements, implied requirements, ambiguities, and missing information.",
    why: "A schema catches shape, not honesty. Well-formed JSON can cite a requirement the ticket never contained. So every explicit requirement must carry a sourceQuote, and that quote is checked against the ticket's own words — whitespace-normalized and case-insensitive, so a quote spanning a line break still passes, but a paraphrase does not. Constrained decoding would not catch this, because the output is structurally perfect.",
    sources: [
      "src/lib/requirements/schema.ts",
      "src/lib/requirements/prompt.ts",
      "src/lib/requirements/extract.ts",
    ],
    evidence: [
      "A fabricated quote and a reordered paraphrase are both rejected in tests.",
      "Implied requirements must not cite a quote — if the ticket states it, it is explicit.",
    ],
  },
  {
    id: "planning",
    number: 3,
    title: "Implementation planning",
    what: "Produces an approach, ordered steps, a test strategy, risks, and explicit out-of-scope items.",
    why: "Each step must cite the requirement ids it satisfies. That single field is what turns coverage from an opinion into set arithmetic. It also creates a new way to cheat — inventing ids — so a step may only cite ids that actually exist.",
    sources: ["src/lib/planning/schema.ts", "src/lib/planning/prompt.ts"],
    evidence: [
      "Live runs first returned step ids as numbers in 3 of 3 cases; the schema rejected every one and the repair loop recovered them.",
      "Fixing the prompt to declare the field's type removed one model call per run: −25% calls, −32% cost, and rubric scores rose.",
    ],
  },
  {
    id: "validation",
    number: 4,
    title: "Deterministic checks",
    what: "Six objective checks over the plan: coverage, test strategy, orphan steps, unmitigated risks, acknowledged ambiguities, steps present.",
    why: "Anything objectively decidable is decided in code. Asking a model whether every requirement is covered would be slower, more expensive, and occasionally wrong about arithmetic. These run before the judge, so a plan already known to be short never costs an evaluation call. Warnings do not block — they are judgment calls surfaced to the human.",
    sources: ["src/lib/validation/checks.ts"],
    evidence: [
      "Free and instant: no model call, no network.",
      "A failing check sends the plan back with the specific reasons attached, before any judge sees it.",
    ],
  },
  {
    id: "evaluation",
    number: 5,
    title: "Rubric evaluation",
    what: `An LLM judge scores ${PLAN_RUBRIC.length} criteria from 1–5 against written anchors, with mandatory evidence per score. Passing threshold: ${PASSING_THRESHOLD}.`,
    why: "Only what genuinely needs judgment reaches the model. The judge must score every criterion exactly once — without that rule it can silently omit the criterion it would score badly, and the average improves for free. That is structurally valid and semantically dishonest, and invisible unless you check for it.",
    sources: ["src/lib/evaluation/rubric.ts", "src/lib/evaluation/schema.ts"],
    evidence: [
      "A scoring that skips, repeats, or invents a criterion is rejected.",
      "A score with empty evidence is rejected — a bare number is unreviewable.",
    ],
  },
  {
    id: "approval",
    number: 6,
    title: "Human approval",
    what: "The run stops. A person approves, or rejects with a written reason.",
    why: "The workflow does not self-approve. Rejection is modelled as a loop back to planning rather than a terminal failure, and the reviewer's note becomes the instruction the next plan is generated against — so a rejection is feedback, not a veto.",
    sources: ["src/lib/workflow/replan.ts", "src/app/api/run/decision/route.ts"],
    evidence: [
      'Verified live: rejecting with "no rollback step, and the export is not paginated" produced a plan addressing both.',
      "The caller holds only an opaque run id; the repair count lives server-side so the bound cannot be bypassed.",
    ],
  },
];

export interface ArchitectureContrast {
  dimension: string;
  workflow: string;
  agent: string;
}

/**
 * The frame everything else hangs on.
 *
 * Without it a reader assumes this is an agent, which inverts the point: the
 * properties worth demonstrating — bounded execution, an inspectable trace,
 * replayable runs — all come from the model *not* directing its own process.
 */
export const ARCHITECTURE = {
  claim: "A workflow, not an agent.",
  body: [
    "The control flow is TypeScript. The model is never given tools, never chooses what happens next, and never decides it is finished. It is asked three questions, and every answer is validated before the next one is asked.",
    "Each call is a fresh conversation. Planning knows about requirements because the orchestrator renders the validated requirements into the planning prompt as structured data — not because anything is remembered between calls.",
  ],
  contrasts: [
    {
      dimension: "Who sequences the work",
      workflow: "Your code, decided before the run starts",
      agent: "The model, decided during the run",
    },
    {
      dimension: "Tools",
      workflow: "None. It returns text and nothing else.",
      agent: "Calls them at will — read, write, search, execute",
    },
    {
      dimension: "Termination",
      workflow: "The state machine reaches a terminal stage",
      agent: "The model decides it is done",
    },
    {
      dimension: "What the trace looks like",
      workflow: "A state machine you can draw in advance",
      agent: "A transcript you read afterwards to find out what happened",
    },
  ] as ArchitectureContrast[],
  /** Where the deterministic half ends and an autonomous one would begin. */
  handoff: {
    heading: "Where an agent would come in",
    body: "Writing the code. That genuinely cannot be specified in advance — you cannot predict which files need reading, how many edits it takes, or what a failing test will turn out to mean, and termination is \"the tests pass\", which has to be discovered. So the natural architecture is a workflow up to approval and an agent after it, with the human gate sitting exactly on that seam: it is the last cheap moment before an expensive, unpredictable process starts. That half is not built, and the run report says so.",
  },
} as const;

export interface RepairMechanism {
  name: string;
  trigger: string;
  feedback: string;
  bound: string;
}

/** Two mechanisms that get conflated as "retry" and behave differently. */
export const REPAIR_MECHANISMS: RepairMechanism[] = [
  {
    name: "Schema repair",
    trigger: "The model returned malformed or dishonest output.",
    feedback: "The specific validation violations, appended with the model's own bad output.",
    bound: `${DEFAULT_MAX_REPAIRS} repairs per stage`,
  },
  {
    name: "Replan",
    trigger: "Output was well-formed but rejected on its merits by the checks, the judge, or a human.",
    feedback: "Failed checks, the weakest rubric criteria with their evidence, or the reviewer's note.",
    bound: `${MAX_REPAIR_ROUNDS} rounds per run`,
  },
];

export const BOUNDS = [
  "A hard attempt ceiling per stage.",
  "An exit the moment output validates.",
  "An immediate abort on a non-retryable provider error, so a rate limit never consumes repair budget meant for schema failures.",
];

export interface Finding {
  title: string;
  body: string;
}

/** Findings that came from running the thing, not from designing it. */
export const FINDINGS: Finding[] = [
  {
    title: "A working repair loop hid a prompt defect",
    body: "Planning returned numeric step ids in every live run. The loop recovered each time, so the system looked healthy — but the prompt had declared the field without its type and invited the error. Fixing the prompt removed a whole model call per run. Coercing the type in the schema would have hidden the defect and paid for it forever.",
  },
  {
    title: "Cost does not follow per-token pricing",
    body: "Opus is 5× Haiku per token but 13× per run, because thinking is on by default and inflates output tokens. On the same ticket all three models scored an identical rubric average, so the extra spend bought no measurable quality.",
  },
  {
    title: "An eval that passed when nothing ran",
    body: 'A coverage assertion checked that the check "did not fail" — trivially true on a run that never reached validation. An eval that passes when nothing happened is worse than no eval.',
  },
  {
    title: "One sample is not a property",
    body: "clarificationNeeded came back true for every fixture, so it looked like a reliable over-flagger and was pinned as a test. A later recording set had it discriminate correctly. The real property is nondeterminism — and the first conclusion made exactly the error this project warns about.",
  },
  {
    title: "A code review found a spend vector",
    body: "The approval endpoint enforced the repair bound against a number the client supplied. A forged run with repairRounds -9999 was accepted and made real billable calls. Validating the shape would not have fixed it, since a client sending 0 forever still buys unlimited replans. The state had to move server-side.",
  },
];

export const MODEL_COMPARISON = SELECTABLE_MODELS.map((m) => ({
  label: m.label,
  costPerRun: m.approxRunCostUsd,
  note: m.note,
}));

export const JUDGE_LIMITATIONS = EVALUATOR_LIMITATIONS;

export const RUBRIC_CRITERIA = PLAN_RUBRIC.map((c) => ({
  label: c.label,
  question: c.question,
}));

export const PRODUCTION_GAPS = [
  "Durable run state, so a run survives a restart.",
  "A sandboxed executor and repository access, so plans become diffs.",
  "Per-tenant isolation, and a shared store so the spend ceiling is not per-instance.",
  "The eval suite gating prompt changes in CI against a tracked pass-rate baseline.",
  "Human-calibrated rubric scoring — the threshold is currently a guess with a decimal point.",
];
