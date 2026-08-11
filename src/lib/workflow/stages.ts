/**
 * The delivery workflow, as a flat ordered list.
 *
 * This is presentation-only for now: it names the pipeline the product is
 * heading toward so the UI can show where a run actually is. Stage status is
 * hardcoded until there is a real state machine to read from — which is
 * deliberate, because a second implemented stage should shape that design.
 */

export type StageStatus = "complete" | "active" | "pending";

export interface WorkflowStage {
  id: string;
  label: string;
  status: StageStatus;
}

export const WORKFLOW_STAGES: WorkflowStage[] = [
  { id: "intake", label: "Ticket intake", status: "active" },
  { id: "requirements", label: "Requirements", status: "pending" },
  { id: "clarify", label: "Clarify", status: "pending" },
  { id: "context", label: "Context", status: "pending" },
  { id: "plan", label: "Plan", status: "pending" },
  { id: "implement", label: "Implement", status: "pending" },
  { id: "validate", label: "Validate", status: "pending" },
  { id: "evaluate", label: "Evaluate", status: "pending" },
  { id: "repair", label: "Repair", status: "pending" },
  { id: "approve", label: "Approve", status: "pending" },
  { id: "report", label: "Report", status: "pending" },
];
