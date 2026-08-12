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
    what: "Checks the ticket against a schema before anything else runs.",
    why: "Bad input should fail right here, not three stages and two model calls later. Acceptance criteria are optional on purpose. A ticket without them is incomplete, not invalid, and pointing out that gap is a later stage's job.",
    sources: ["src/lib/ticket/schema.ts", "src/components/ticket-intake/TicketIntakeForm.tsx"],
    evidence: [
      "Rejects a ticket with an unknown priority, a missing title, or a non-object body.",
      "The API uses the same schema as the form, so the two can't disagree about what a valid ticket is.",
    ],
  },
  {
    id: "requirements",
    number: 2,
    title: "Requirement extraction",
    what: "Turns the ticket text into explicit requirements, implied ones, open questions, and what's missing.",
    why: "A schema catches shape, not honesty. Perfectly valid JSON can cite a requirement the ticket never had. So every explicit requirement has to come with a quote, and I check that quote against the actual ticket text. Whitespace and case are ignored, so a quote that runs across a line break still passes, but a paraphrase gets rejected. Constrained decoding wouldn't catch this one, because the JSON is already well formed.",
    sources: [
      "src/lib/requirements/schema.ts",
      "src/lib/requirements/prompt.ts",
      "src/lib/requirements/extract.ts",
    ],
    evidence: [
      "Made-up quotes and reworded ones both get rejected in tests.",
      "Implied requirements aren't allowed to cite a quote. If the ticket says it, it's explicit.",
    ],
  },
  {
    id: "planning",
    number: 3,
    title: "Implementation planning",
    what: "Produces an approach, ordered steps, a test strategy, risks, and what's out of scope.",
    why: "Each step has to list the requirement ids it covers. That one field turns coverage from an opinion into arithmetic I can check. It also opens up a new way to cheat, which is making up ids, so a step can only cite ids that actually exist.",
    sources: ["src/lib/planning/schema.ts", "src/lib/planning/prompt.ts"],
    evidence: [
      "The first live runs came back with step ids as numbers in all 3 cases. The schema caught every one and the repair loop fixed them.",
      "Saying in the prompt that the id is a string removed a whole model call per run. 25% fewer calls, 32% cheaper, and the scores went up.",
    ],
  },
  {
    id: "validation",
    number: 4,
    title: "Deterministic checks",
    what: "Six checks over the plan that don't need a model: coverage, test strategy, orphan steps, risks without mitigations, whether open questions carried through, and whether there are steps at all.",
    why: "If something can be checked objectively, I check it in code. Asking a model whether every requirement is covered would be slower, cost more, and sometimes get the counting wrong. These run before the judge, so a plan I already know is short never costs an evaluation call. Warnings don't block anything. They're judgment calls, so they go to the person instead.",
    sources: ["src/lib/validation/checks.ts"],
    evidence: [
      "Free and instant. No model call, no network.",
      "A failed check sends the plan back with the reasons attached, before any judge sees it.",
    ],
  },
  {
    id: "evaluation",
    number: 5,
    title: "Rubric evaluation",
    what: `An LLM judge scores ${PLAN_RUBRIC.length} criteria from 1–5 against written anchors, with mandatory evidence per score. Passing threshold: ${PASSING_THRESHOLD}.`,
    why: "Only the stuff that actually needs judgment gets to the model. The judge has to score every criterion exactly once. Without that rule it can quietly skip the one it would score badly, and the average goes up for free. The JSON still looks fine, so you would never notice unless you check.",
    sources: ["src/lib/evaluation/rubric.ts", "src/lib/evaluation/schema.ts"],
    evidence: [
      "A scoring that skips, repeats, or invents a criterion gets rejected.",
      "A score with no evidence gets rejected. A number on its own tells you nothing.",
    ],
  },
  {
    id: "approval",
    number: 6,
    title: "Human approval",
    what: "The run stops and waits. A person approves it, or rejects it with a reason.",
    why: "This is the part I think matters most. The workflow never approves itself, because verification is the job now. Models are good enough that plausible and correct look identical on the screen, and the person reading it is the last check before something half-thought-out gets built and shipped. Everything upstream exists to make that review fast and specific instead of a vibe check: the citations are already verified, the coverage math is already done, so the reviewer can spend their attention on the parts only a person can catch. And rejecting sends it back to planning instead of killing the run, with whatever the reviewer wrote becoming the instruction for the next plan. So a rejection is feedback, not a veto.",
    sources: ["src/lib/workflow/replan.ts", "src/app/api/run/decision/route.ts"],
    evidence: [
      'Tried it live. Rejecting with "no rollback step, and the export is not paginated" came back with a plan that handled both.',
      "The browser only holds a run id. The repair count lives on the server, so you can't get extra tries by editing the request.",
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
 * properties worth demonstrating (bounded execution, an inspectable trace,
 * replayable runs) all come from the model *not* directing its own process.
 */
export const ARCHITECTURE = {
  claim: "A workflow, not an agent.",
  body: [
    "The control flow is TypeScript. The model never gets tools, never picks what happens next, and never decides it's done. It gets asked three questions, and every answer is checked before the next one goes out.",
    "Each call is a fresh conversation. Planning knows about the requirements because my code drops them into the planning prompt, not because anything gets remembered between calls.",
  ],
  contrasts: [
    {
      dimension: "Who sequences the work",
      workflow: "Your code, decided before the run starts",
      agent: "The model, decided during the run",
    },
    {
      dimension: "Tools",
      workflow: "None. It returns text and that's it.",
      agent: "Calls them whenever it wants: read, write, search, execute",
    },
    {
      dimension: "Termination",
      workflow: "The state machine hits an end state",
      agent: "The model decides it's done",
    },
    {
      dimension: "What the trace looks like",
      workflow: "A state machine you could draw before it runs",
      agent: "A transcript you read afterward to find out what it did",
    },
  ] as ArchitectureContrast[],
  /** Where the deterministic half ends and an autonomous one would begin. */
  handoff: {
    heading: "Where an agent would come in",
    body: "Writing the code. You can't lay those steps out ahead of time. There's no way to know which files need reading, how many edits it takes, or what a failing test will turn out to mean, and the stopping condition is \"the tests pass\", which it has to find out for itself. So the natural split is a workflow up to approval and an agent after it, with the human gate sitting right on the seam. That's the last cheap moment before something expensive and unpredictable kicks off. That half isn't built, and the run report says so.",
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
    body: "Planning returned numeric step ids in every live run. The loop fixed it each time, so everything looked fine, but the prompt had never said the field was a string. That's what caused it. Fixing the prompt removed a whole model call per run. I could have just coerced the type in the schema instead, but that would have buried the bug and kept paying for the extra call forever.",
  },
  {
    title: "Cost does not follow per-token pricing",
    body: "Opus is 5x Haiku per token but 13x per run, because thinking is on by default and blows up the output. On the same ticket all three models landed on the same rubric average, so the extra money bought nothing I could measure.",
  },
  {
    title: "An eval that passed when nothing ran",
    body: 'A coverage assertion checked that the check "did not fail", which is automatically true on a run that never got as far as validation. An eval that passes when nothing happened is worse than having no eval.',
  },
  {
    title: "One sample is not a property",
    body: "clarificationNeeded came back true for every fixture, so I figured it just over-flags and pinned that as a test. A later set of recordings had it get the answer right. So it's really just nondeterministic, and my first conclusion made exactly the mistake this project warns about.",
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
  "Rubric scores calibrated against human raters. Right now the threshold is a guess with a decimal point.",
];
