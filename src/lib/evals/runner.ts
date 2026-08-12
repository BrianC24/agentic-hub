import type { ModelProvider } from "@/lib/llm/types";
import { runWorkflow } from "@/lib/workflow/orchestrator";
import { EVAL_CASES, type EvalCase, type EvalContext } from "./cases";

export interface AssertionResult {
  id: string;
  description: string;
  passed: boolean;
}

export interface CaseResult {
  key: string;
  label: string;
  finalStage: string;
  assertions: AssertionResult[];
  passed: boolean;
  modelCalls: number;
  /** Extra attempts inside a stage: the model returned invalid output. */
  schemaRepairs: number;
  /** Times a plan was sent back by failed checks or a low rubric score. */
  repairRounds: number;
  latencyMs: number;
  estimatedCostUsd: number | null;
  error: string | null;
}

export interface EvalReport {
  results: CaseResult[];
  passedCases: number;
  totalCases: number;
  passRate: number;
  totalCostUsd: number;
  totalLatencyMs: number;
  totalModelCalls: number;
}

/**
 * Runs the eval suite.
 *
 * Assertions are evaluated against whatever the workflow produced, including
 * partial output from a failed run, because a case that fails early should report
 * which assertions it missed, not vanish from the report.
 */
export async function runEvals(
  providerFor: (evalCase: EvalCase) => ModelProvider,
  cases: EvalCase[] = EVAL_CASES,
): Promise<EvalReport> {
  const results: CaseResult[] = [];

  for (const evalCase of cases) {
    let result: CaseResult;
    try {
      const workflow = await runWorkflow(providerFor(evalCase), evalCase.ticket);
      const ctx: EvalContext = {
        requirements: workflow.artifacts.requirements,
        plan: workflow.artifacts.plan,
        validation: workflow.artifacts.validation,
        evaluation: workflow.artifacts.evaluation,
        finalStage: workflow.run.stage,
      };

      const assertions = evalCase.assertions.map((a) => ({
        id: a.id,
        description: a.description,
        // An assertion that throws is a failed assertion, not a crashed suite.
        passed: safeCheck(() => a.check(ctx)),
      }));

      // Two distinct repair mechanisms, worth separating: a schema repair is
      // the model producing malformed output, while a repair round is a
      // well-formed plan being rejected on its merits.
      const schemaRepairs = workflow.artifacts.stageRuns.reduce(
        (acc, r) => acc + Math.max(0, r.attempts - 1),
        0,
      );
      result = {
        key: evalCase.key,
        label: evalCase.label,
        finalStage: workflow.run.stage,
        assertions,
        passed: assertions.every((a) => a.passed),
        modelCalls: workflow.totals.modelCalls,
        schemaRepairs,
        repairRounds: workflow.run.repairRounds,
        latencyMs: workflow.totals.latencyMs,
        estimatedCostUsd: workflow.totals.estimatedCostUsd,
        error: null,
      };
    } catch (error) {
      result = {
        key: evalCase.key,
        label: evalCase.label,
        finalStage: "crashed",
        assertions: evalCase.assertions.map((a) => ({
          id: a.id,
          description: a.description,
          passed: false,
        })),
        passed: false,
        modelCalls: 0,
        schemaRepairs: 0,
        repairRounds: 0,
        latencyMs: 0,
        estimatedCostUsd: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    results.push(result);
  }

  const passedCases = results.filter((r) => r.passed).length;
  return {
    results,
    passedCases,
    totalCases: results.length,
    passRate: results.length > 0 ? passedCases / results.length : 0,
    totalCostUsd: results.reduce((acc, r) => acc + (r.estimatedCostUsd ?? 0), 0),
    totalLatencyMs: results.reduce((acc, r) => acc + r.latencyMs, 0),
    totalModelCalls: results.reduce((acc, r) => acc + r.modelCalls, 0),
  };
}

function safeCheck(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

/** Human-readable report, used by the CLI and pasted into docs. */
export function formatEvalReport(report: EvalReport): string {
  const lines: string[] = [];

  for (const result of report.results) {
    lines.push(
      `${result.passed ? "PASS" : "FAIL"}  ${result.key} (${result.finalStage})` +
        `  ${result.modelCalls} calls, ${result.schemaRepairs} schema-repair(s), ` +
        `${result.repairRounds} replan(s), ` +
        `${(result.latencyMs / 1000).toFixed(1)}s, ` +
        `$${(result.estimatedCostUsd ?? 0).toFixed(4)}`,
    );
    for (const assertion of result.assertions) {
      if (!assertion.passed) {
        lines.push(`        missed: ${assertion.description}`);
      }
    }
    if (result.error) {
      lines.push(`        error: ${result.error}`);
    }
  }

  lines.push("");
  lines.push(
    `${report.passedCases}/${report.totalCases} cases passed ` +
      `(${(report.passRate * 100).toFixed(0)}%), ` +
      `${report.totalModelCalls} model calls, ` +
      `${(report.totalLatencyMs / 1000).toFixed(1)}s, ` +
      `$${report.totalCostUsd.toFixed(4)}`,
  );

  return lines.join("\n");
}
