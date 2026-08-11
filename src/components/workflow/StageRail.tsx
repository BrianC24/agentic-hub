import { WORKFLOW_STAGES, type StageStatus } from "@/lib/workflow/stages";
import styles from "./StageRail.module.css";

const STATUS_CLASS: Record<StageStatus, string> = {
  active: styles.active,
  complete: styles.complete,
  pending: "",
};

/**
 * Horizontal view of the delivery pipeline. Announced as a list so screen
 * readers get the stage order, with the active stage marked via aria-current.
 */
export function StageRail() {
  return (
    <nav aria-label="Workflow stages">
      <ol className={styles.rail}>
        {WORKFLOW_STAGES.map((stage, index) => (
          <li
            key={stage.id}
            className={`${styles.stage} ${STATUS_CLASS[stage.status]}`}
            aria-current={stage.status === "active" ? "step" : undefined}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.index}>{index + 1}</span>
            {stage.label}
            {stage.status === "pending" && <span className="sr-only"> (not yet implemented)</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
