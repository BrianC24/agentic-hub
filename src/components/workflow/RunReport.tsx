"use client";

import { useState } from "react";
import { formatCostUsd } from "@/lib/llm/cost";
import { PLAN_RUBRIC } from "@/lib/evaluation/rubric";
import type { WorkflowResult } from "@/lib/workflow/orchestrator";
import type { CheckStatus } from "@/lib/validation/checks";
import styles from "./RunReport.module.css";

export interface RunReportProps {
  result: WorkflowResult;
  mode: "replay" | "live";
  model: string;
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

export function RunReport({ result, mode, model }: RunReportProps) {
  const { run, artifacts, totals } = result;
  const reachedApproval = run.stage === "awaiting_approval";

  return (
    <div className={styles.report}>
      <div
        className={`${styles.banner} ${reachedApproval ? styles.bannerOk : styles.bannerBad}`}
        role="status"
      >
        <span className={styles.statusDot} aria-hidden="true" />
        {reachedApproval
          ? "Plan ready for human approval"
          : `Run ${run.stage}${run.failureReason ? ` — ${run.failureReason}` : ""}`}
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
          count={`avg ${artifacts.evaluation.averageScore.toFixed(2)} — ${
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
                  {stageRun.attempts} attempts — repaired:{" "}
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

      {reachedApproval && <ApprovalGate />}
    </div>
  );
}

function Metrics({ totals, model }: { totals: WorkflowResult["totals"]; model: string }) {
  return (
    <div className={styles.metrics}>
      <Metric label="Model calls" value={String(totals.modelCalls)} />
      <Metric
        label="Tokens"
        value={`${totals.usage.inputTokens + totals.usage.outputTokens}`}
      />
      <Metric label="Latency" value={`${(totals.latencyMs / 1000).toFixed(1)}s`} />
      <Metric label="Est. cost" value={formatCostUsd(totals.estimatedCostUsd)} />
      <Metric label="Model" value={model.replace("claude-", "")} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        {title}
        {count && <span className={styles.panelCount}>{count}</span>}
      </div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

/**
 * The human gate.
 *
 * The decision is recorded client-side only: this build has no persistence, so
 * pretending the choice was durably stored would be dishonest. What it does
 * demonstrate is that the workflow stops and waits rather than self-approving.
 */
function ApprovalGate() {
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);

  if (decision) {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHead}>Human approval</div>
        <div className={styles.panelBody}>
          <div className={styles.decided}>
            <strong>{decision === "approved" ? "Approved" : "Rejected"}</strong>
            {note && ` — ${note}`}
            <div className={styles.checkDetail}>
              Recorded in this session only. Persisting decisions across runs is a known
              limitation.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>Human approval</div>
      <div className={styles.panelBody}>
        <div className={styles.approval}>
          <label htmlFor="approval-note" className={styles.metricLabel}>
            Note (optional)
          </label>
          <textarea
            id="approval-note"
            className={styles.approvalNote}
            value={note}
            placeholder="Why are you approving or rejecting this plan?"
            onChange={(e) => setNote(e.target.value)}
          />
          <div className={styles.approvalActions}>
            <button
              type="button"
              className={styles.approveButton}
              onClick={() => setDecision("approved")}
            >
              Approve plan
            </button>
            <button
              type="button"
              className={styles.rejectButton}
              onClick={() => setDecision("rejected")}
            >
              Reject and replan
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
