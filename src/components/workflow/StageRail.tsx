import type { RunStage } from "@/lib/workflow/run";
import styles from "./StageRail.module.css";

/** The stages a run visibly moves through, in order. */
const RAIL_STAGES: { id: RunStage; label: string }[] = [
  { id: "intake", label: "Intake" },
  { id: "requirements", label: "Requirements" },
  { id: "planning", label: "Planning" },
  { id: "validation", label: "Checks" },
  { id: "evaluation", label: "Evaluation" },
  { id: "awaiting_approval", label: "Approval" },
];

export interface StageRailProps {
  activeStage: RunStage;
}

/**
 * Horizontal view of the pipeline.
 *
 * Announced as an ordered list so the stage sequence is available to screen
 * readers, with the current stage marked via aria-current.
 */
export function StageRail({ activeStage }: StageRailProps) {
  // Neither terminal stage appears on the rail, so both need handling:
  // a completed run has finished every stage, while a failed one has no
  // meaningful position and is shown with nothing marked.
  const resolvedIndex =
    activeStage === "complete"
      ? RAIL_STAGES.length
      : activeStage === "failed"
        ? -1
        : RAIL_STAGES.findIndex((s) => s.id === activeStage);

  return (
    <nav aria-label="Workflow stages">
      <ol className={styles.rail}>
        {RAIL_STAGES.map((stage, index) => {
          const status =
            resolvedIndex < 0
              ? "pending"
              : index < resolvedIndex
                ? "complete"
                : index === resolvedIndex
                  ? "active"
                  : "pending";

          return (
            <li
              key={stage.id}
              className={`${styles.stage} ${status === "active" ? styles.active : status === "complete" ? styles.complete : ""}`}
              aria-current={status === "active" ? "step" : undefined}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.index}>{index + 1}</span>
              {stage.label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
