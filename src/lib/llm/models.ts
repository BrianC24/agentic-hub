import { MODEL_PRICING } from "./cost";

/**
 * Models a client is allowed to request.
 *
 * This is an allowlist, not a suggestion list. The API route validates against
 * it, because letting a request name an arbitrary model string would hand a
 * caller control over spend — a single crafted request could select the most
 * expensive model available.
 */
export interface SelectableModel {
  id: string;
  label: string;
  /** Rough cost of one full workflow run, from measured token counts. */
  approxRunCostUsd: number;
  note: string;
}

/**
 * Costs are measured, not extrapolated — one full workflow run each on the
 * same ticket, 2026-08-11.
 *
 * The spread is wider than per-token pricing suggests: Opus is 5x Haiku per
 * token but 13x per run, because thinking is on by default and inflates output
 * (7,558 output tokens vs Haiku's ~2,800). All three produced the same rubric
 * average (4.4) on that ticket, so the extra spend bought no measurable
 * quality here.
 */
export const SELECTABLE_MODELS: SelectableModel[] = [
  {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    approxRunCostUsd: 0.017,
    note: "Measured ~28s per run. What the recordings and eval numbers use.",
  },
  {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    approxRunCostUsd: 0.075,
    note: "Measured 4.4x Haiku's cost and ~45s per run.",
  },
  {
    id: "claude-opus-5",
    label: "Opus 5",
    approxRunCostUsd: 0.22,
    note: "Measured 13x Haiku and ~98s per run — thinking is on by default and counts toward output.",
  },
];

export const DEFAULT_SELECTABLE_MODEL = SELECTABLE_MODELS[0].id;

export function isSelectableModel(model: unknown): model is string {
  return typeof model === "string" && SELECTABLE_MODELS.some((m) => m.id === model);
}

export function getSelectableModel(id: string): SelectableModel | undefined {
  return SELECTABLE_MODELS.find((m) => m.id === id);
}

/**
 * Resolves which model a run should use.
 *
 * Precedence: an explicit request, then the configured ANTHROPIC_MODEL, then
 * the built-in default. The middle step matters — without it the env var would
 * govern the CLI scripts while the web UI silently ignored it. A configured
 * model that is off the allowlist (a preview model, a typo) is not inherited.
 */
export function resolveModel(requested: unknown, configured: unknown): string {
  if (isSelectableModel(requested)) return requested;
  if (isSelectableModel(configured)) return configured;
  return DEFAULT_SELECTABLE_MODEL;
}

/** Every selectable model must be priced, or the run report shows "unknown". */
export function unpricedSelectableModels(): string[] {
  return SELECTABLE_MODELS.filter((m) => !(m.id in MODEL_PRICING)).map((m) => m.id);
}
