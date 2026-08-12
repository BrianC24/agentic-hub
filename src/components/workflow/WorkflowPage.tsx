"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/nav/TopBar";
import { TicketIntakeForm } from "@/components/ticket-intake/TicketIntakeForm";
import { StageRail } from "@/components/workflow/StageRail";
import { RunReport } from "@/components/workflow/RunReport";
import { DEFAULT_SELECTABLE_MODEL, type SelectableModel } from "@/lib/llm/models";
import { hasRecording } from "@/lib/replay";
import type { Ticket } from "@/lib/ticket/schema";
import type { WorkflowResult } from "@/lib/workflow/orchestrator";
import styles from "./WorkflowPage.module.css";

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | {
      status: "done";
      result: WorkflowResult;
      mode: "replay" | "live" | "none";
      model: string;
      /** Server-side handle; absent once the run is decided or failed. */
      runId: string | null;
    }
  | { status: "error"; message: string };

export function WorkflowPage() {
  const [state, setState] = useState<RunState>({ status: "idle" });
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [preferLive, setPreferLive] = useState(false);
  const [models, setModels] = useState<SelectableModel[]>([]);
  const [model, setModel] = useState(DEFAULT_SELECTABLE_MODEL);
  const [fixtureKey, setFixtureKey] = useState<string | null>(null);
  const [limits, setLimits] = useState<{
    dailyBudgetUsd?: number;
    remainingBudgetUsd?: number;
    liveRunsRemaining?: number;
  }>({});
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // The server decides whether live runs are possible; the client only asks.
  useEffect(() => {
    fetch("/api/run")
      .then((r) => r.json())
      .then((d) => {
        setLiveEnabled(Boolean(d.liveEnabled));
        setModels(d.models ?? []);
        if (d.defaultModel) setModel(d.defaultModel);
        setLimits({
          dailyBudgetUsd: d.dailyBudgetUsd,
          remainingBudgetUsd: d.remainingBudgetUsd,
          liveRunsRemaining: d.liveRunsRemaining,
        });
      })
      .catch(() => setLiveEnabled(false));
  }, []);

  async function startRun(submitted: Ticket, key: string | null) {
    setDecisionError(null);
    setState({ status: "running" });
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: submitted,
          fixtureKey: key,
          model,
          mode: preferLive && liveEnabled ? "live" : "replay",
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setState({ status: "error", message: payload.error ?? "Run failed" });
        return;
      }
      setState({
        status: "done",
        result: payload as WorkflowResult,
        mode: payload.mode,
        model: payload.model,
        runId: payload.runId ?? null,
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Network error",
      });
    }
  }

  async function submitDecision(decision: "approved" | "rejected", note: string) {
    if (state.status !== "done" || !state.runId) return;
    setDeciding(true);
    setDecisionError(null);
    try {
      const response = await fetch("/api/run/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only an opaque handle: the server holds the run, its artifacts, and
        // its repair count, so none of them can be forged from here.
        body: JSON.stringify({ decision, note, model, runId: state.runId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setDecisionError(payload.error ?? "Decision failed");
        return;
      }
      setState({
        status: "done",
        result: payload as WorkflowResult,
        mode: payload.mode,
        model: payload.model,
        runId: payload.runId ?? null,
      });
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : "Network error");
    } finally {
      setDeciding(false);
    }
  }

  const activeStage =
    state.status === "done" ? state.result.run.stage : state.status === "running" ? "requirements" : "intake";

  return (
    <div className={styles.shell}>
      <TopBar>
        {liveEnabled ? (
          <>
            <label className={styles.modeToggle}>
              <input
                type="checkbox"
                checked={preferLive}
                onChange={(e) => setPreferLive(e.target.checked)}
              />
              Live model calls
            </label>
            <label className={styles.modelPicker}>
              <span className="sr-only">Model</span>
              <select
                value={model}
                disabled={!preferLive}
                onChange={(e) => setModel(e.target.value)}
                title={models.find((m) => m.id === model)?.note ?? "Model used for live runs"}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · ~${m.approxRunCostUsd.toFixed(3)}/run
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <span>Replay mode</span>
        )}
      </TopBar>

      <main className={styles.main}>
        <StageRail activeStage={activeStage} />

        <div className={styles.header}>
          <p className={styles.eyebrow}>Ticket intake</p>
          <h1 className={styles.title}>Run a ticket through the delivery harness</h1>
          <p className={styles.lede}>
            The ticket is schema-validated, requirements are extracted and checked against the
            ticket&apos;s own words, a plan is generated and put through deterministic checks and a
            rubric evaluation, and the run stops for human approval. Every model call is traced with
            its tokens, latency, and cost.
          </p>
        </div>

        <RunModeHint
          live={preferLive && liveEnabled}
          model={models.find((m) => m.id === model)}
          fixtureKey={fixtureKey}
          limits={limits}
        />

        <TicketIntakeForm
          onValidated={startRun}
          onTicketChanged={setFixtureKey}
          busy={state.status === "running"}
        />

        {state.status === "running" && (
          <div className={styles.running} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            Running the workflow — extraction, planning, checks, and evaluation.
            {preferLive && liveEnabled && " Live calls take around 30 seconds."}
          </div>
        )}

        {state.status === "error" && (
          <div className={styles.error} role="alert">
            {state.message}
          </div>
        )}

        {state.status === "done" && (
          <RunReport
            result={state.result}
            mode={state.mode}
            model={state.model}
            onDecision={submitDecision}
            deciding={deciding}
            decisionError={decisionError}
          />
        )}
      </main>
    </div>
  );
}

/**
 * Says up front which mode a run will use, and what it will cost.
 *
 * Without this the only way to discover that a ticket has no recording is to
 * submit it and read an error, which is a poor way to learn how the demo works.
 */
function RunModeHint({
  live,
  model,
  fixtureKey,
  limits,
}: {
  live: boolean;
  model: SelectableModel | undefined;
  fixtureKey: string | null;
  limits: { dailyBudgetUsd?: number; remainingBudgetUsd?: number; liveRunsRemaining?: number };
}) {
  const replayable = fixtureKey !== null && hasRecording(fixtureKey);

  if (live) {
    return (
      <div className={styles.hint}>
        <strong>Live run.</strong> Calls {model?.label ?? "the model"} for real — about{" "}
        ${model?.approxRunCostUsd.toFixed(3) ?? "0.02"} and ~30s.
        {limits.liveRunsRemaining !== undefined && (
          <>
            {" "}
            {limits.liveRunsRemaining} live run{limits.liveRunsRemaining === 1 ? "" : "s"} left for
            you this hour
            {limits.remainingBudgetUsd !== undefined &&
              `, $${limits.remainingBudgetUsd.toFixed(2)} of today's $${limits.dailyBudgetUsd?.toFixed(2)} demo budget remaining`}
            .
          </>
        )}
      </div>
    );
  }

  if (replayable) {
    return (
      <div className={styles.hint}>
        <strong>Replay run.</strong> Uses recorded responses for this example — free and instant.
        The workflow itself runs for real; only the transport is swapped.
      </div>
    );
  }

  return (
    <div className={`${styles.hint} ${styles.hintWarn}`}>
      <strong>No recording for this ticket.</strong> Load one of the examples to replay it for
      free, or enable live model calls to run it against the API.
    </div>
  );
}
