"use client";

import { useState } from "react";
import { formatCostUsd } from "@/lib/llm/cost";
import { PLAN_RUBRIC } from "@/lib/evaluation/rubric";
import type { WorkflowResult } from "@/lib/workflow/orchestrator";
import type { CheckStatus } from "@/lib/validation/checks";
import { Metrics, Panel } from "./report/primitives";
import styles from "./RunReport.module.css";

export interface RunReportProps {
  result: WorkflowResult;
  mode: "replay" | "live" | "none";
  model: string;
  /** Absent when decisions cannot be acted on (e.g. a completed run). */
  onDecision?: (decision: "approved" | "rejected", note: string) => void;
  deciding?: boolean;
  decisionError?: string | null;
}

const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: styles.pass,
  fail: styles.fail,
  warn: styles.warn,
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: "PASS",
  fail: "FAIL",
  warn: "WARN",
};

const CRITERION_LABEL = new Map(PLAN_RUBRIC.map((c) => [c.id, c.label]));

export function RunReport({
  result,
  mode,
  model,
  onDecision,
  deciding = false,
  decisionError = null,
}: RunReportProps) {
  const { run, artifacts, totals } = result;
  const reachedApproval = run.stage === "awaiting_approval";
  const isComplete = run.stage === "complete";

  return (
    <div className={styles.report}>
      <div
        className={`${styles.banner} ${reachedApproval || isComplete ? styles.bannerOk : styles.bannerBad}`}
        role="status"
      >
        <span className={styles.statusDot} aria-hidden="true" />
        {reachedApproval
          ? "Plan ready for human approval"
          : isComplete
            ? `Approved${run.approval?.note ? `: ${run.approval.note}` : ""}`
            : `Run ${run.stage}${run.failureReason ? `: ${run.failureReason}` : ""}`}
        <span className={styles.badge}>{mode}</span>
      </div>

      <Metrics totals={totals} model={model} />

      {artifacts.requirements && (
        <Panel title="Requirements" count={`${artifacts.requirements.explicitRequirements.length} explicit`}>
          <div className={styles.list}>
            {artifacts.requirements.explicitRequirements.map((r) => (
              <div key={r.id} className={styles.listItem}>
                <span className={styles.stepId}>{r.id}</span>
                <span>{r.text}</span>
              </div>
            ))}
          </div>
          {artifacts.requirements.ambiguities.length > 0 && (
            <>
              <div className={styles.metricLabel}>Ambiguities raised</div>
              <div className={styles.list}>
                {artifacts.requirements.ambiguities.map((a) => (
                  <div key={a.question} className={styles.listItem}>
                    <span className={styles.bullet}>?</span>
                    <span>{a.question}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      )}

      {artifacts.plan && (
        <Panel title="Implementation plan" count={`${artifacts.plan.steps.length} steps`}>
          <p className={styles.checkDetail}>{artifacts.plan.approach}</p>
          {artifacts.plan.steps.map((step) => (
            <div key={step.id} className={styles.step}>
              <div className={styles.stepHead}>
                <span className={styles.stepId}>{step.id}</span>
                <span>{step.description}</span>
              </div>
              <div className={styles.tags}>
                {step.addressesRequirements.map((id) => (
                  <span key={id} className={styles.tag}>
                    {id}
                  </span>
                ))}
                {step.files.map((f) => (
                  <span key={f} className={styles.tag}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </Panel>
      )}

      {artifacts.validation && (
        <Panel
          title="Deterministic checks"
          count={`${artifacts.validation.failedCount} failed · ${artifacts.validation.warnedCount} warned`}
        >
          {artifacts.validation.results.map((check) => (
            <div key={check.id} className={styles.check}>
              <span className={`${styles.checkIcon} ${STATUS_CLASS[check.status]}`}>
                {STATUS_LABEL[check.status]}
              </span>
              <span>
                <span className={styles.checkLabel}>{check.label}</span>
                <div className={styles.checkDetail}>{check.detail}</div>
              </span>
            </div>
          ))}
        </Panel>
      )}

      {artifacts.evaluation && (
        <Panel
          title="Rubric evaluation"
          count={`avg ${artifacts.evaluation.averageScore.toFixed(2)}, ${
            artifacts.evaluation.passed ? "pass" : "below threshold"
          }`}
        >
          {artifacts.evaluation.evaluation.scores.map((score) => (
            <div key={score.criterionId} className={styles.criterion}>
              <div className={styles.criterionHead}>
                <span className={`${styles.score} ${score.score < 4 ? styles.scoreLow : ""}`}>
                  {score.score}/5
                </span>
                {CRITERION_LABEL.get(score.criterionId) ?? score.criterionId}
              </div>
              <div className={styles.evidence}>{score.evidence}</div>
            </div>
          ))}
        </Panel>
      )}

      <Panel title="Model call trace" count={`${totals.modelCalls} calls`}>
        {artifacts.stageRuns.map((stageRun, i) => (
          <div key={`${stageRun.stage}-${stageRun.round}-${i}`} className={styles.traceRow}>
            <span className={styles.traceStage}>
              {stageRun.stage}
              {stageRun.round > 0 && ` (round ${stageRun.round})`}
            </span>
            <span className={styles.traceDetail}>
              {stageRun.attempts > 1 ? (
                <span className={styles.repaired}>
                  {stageRun.attempts} attempts, repaired:{" "}
                  {stageRun.violations[0]?.message ?? "schema violation"}
                </span>
              ) : (
                "valid on first attempt"
              )}
            </span>
            <span className={styles.traceMetrics}>
              {stageRun.usage.inputTokens}in/{stageRun.usage.outputTokens}out ·{" "}
              {(stageRun.latencyMs / 1000).toFixed(1)}s · {formatCostUsd(stageRun.estimatedCostUsd)}
            </span>
          </div>
        ))}
      </Panel>

      {reachedApproval && onDecision && (
        <ApprovalGate onDecision={onDecision} busy={deciding} error={decisionError} />
      )}

      {run.repairRounds > 0 && (
        <p className={styles.nextStep}>
          This plan is revision {run.repairRounds + 1}. Earlier versions were sent back by failed
          checks, a low rubric score, or a reviewer.
        </p>
      )}
    </div>
  );
}

/**
 * The human gate.
 *
 * Approving ends the run. Rejecting sends the plan back to planning with the
 * reviewer's  note as feedback, using the same repair path a failed rubric score
 * takes, except the instruction is written by a person.
 */
function ApprovalGate({
  onDecision,
  busy,
  error,
}: {
  onDecision: (decision: "approved" | "rejected", note: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [note, setNote] = useState("");

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>Human approval</div>
      <div className={styles.panelBody}>
        <div className={styles.approval}>
          <label htmlFor="approval-note" className={styles.metricLabel}>
            Note {""}
            <span className={styles.checkDetail}>
              on rejection this is sent to the model as the instruction for the next plan
            </span>
          </label>
          <textarea
            id="approval-note"
            className={styles.approvalNote}
            value={note}
            disabled={busy}
            placeholder="e.g. No rollback step, and the migration is not reversible."
            onChange={(e) => setNote(e.target.value)}
          />
          <div className={styles.approvalActions}>
            <button
              type="button"
              className={styles.approveButton}
              disabled={busy}
              onClick={() => onDecision("approved", note)}
            >
              {busy ? "Working…" : "Approve plan"}
            </button>
            <button
              type="button"
              className={styles.rejectButton}
              disabled={busy}
              onClick={() => onDecision("rejected", note)}
            >
              Reject and replan
            </button>
          </div>
          {error && (
            <div className={styles.errorText} role="alert">
              {error}
            </div>
          )}
          <div className={styles.checkDetail}>
            Rejecting runs a real replan and costs a live model call. Decisions are not persisted,
            a refresh loses the run.
          </div>
        </div>
      </div>
    </section>
  );
}
