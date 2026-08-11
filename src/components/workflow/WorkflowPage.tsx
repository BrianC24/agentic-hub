"use client";

import { useEffect, useState } from "react";
import { TicketIntakeForm } from "@/components/ticket-intake/TicketIntakeForm";
import { StageRail } from "@/components/workflow/StageRail";
import { RunReport } from "@/components/workflow/RunReport";
import type { Ticket } from "@/lib/ticket/schema";
import type { WorkflowResult } from "@/lib/workflow/orchestrator";
import styles from "./WorkflowPage.module.css";

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: WorkflowResult; mode: "replay" | "live"; model: string }
  | { status: "error"; message: string };

export function WorkflowPage() {
  const [state, setState] = useState<RunState>({ status: "idle" });
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [preferLive, setPreferLive] = useState(false);

  // The server decides whether live runs are possible; the client only asks.
  useEffect(() => {
    fetch("/api/run")
      .then((r) => r.json())
      .then((d) => setLiveEnabled(Boolean(d.liveEnabled)))
      .catch(() => setLiveEnabled(false));
  }, []);

  async function startRun(ticket: Ticket, fixtureKey: string | null) {
    setState({ status: "running" });
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket,
          fixtureKey,
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
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Network error",
      });
    }
  }

  const activeStage =
    state.status === "done" ? state.result.run.stage : state.status === "running" ? "requirements" : "intake";

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <span className={styles.mark} aria-hidden="true">
            AH
          </span>
          <span className={styles.wordmark}>Agentic Hub</span>
          <div className={styles.topbarMeta}>
            {liveEnabled ? (
              <label className={styles.modeToggle}>
                <input
                  type="checkbox"
                  checked={preferLive}
                  onChange={(e) => setPreferLive(e.target.checked)}
                />
                Live model calls
              </label>
            ) : (
              <span>Replay mode</span>
            )}
          </div>
        </div>
      </header>

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

        <TicketIntakeForm onValidated={startRun} busy={state.status === "running"} />

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
          <RunReport result={state.result} mode={state.mode} model={state.model} />
        )}
      </main>
    </div>
  );
}
