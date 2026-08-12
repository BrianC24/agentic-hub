"use client";

import { formatCostUsd } from "@/lib/llm/cost";
import type { WorkflowResult } from "@/lib/workflow/orchestrator";
import styles from "../RunReport.module.css";

/** Shared layout pieces for the run report. */

export function Metrics({ totals, model }: { totals: WorkflowResult["totals"]; model: string }) {
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

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
}

export function Panel({
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

