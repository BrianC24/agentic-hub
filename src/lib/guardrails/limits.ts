import { getSelectableModel } from "@/lib/llm/models";
import type { Ticket } from "@/lib/ticket/schema";

/**
 * Input and model ceilings for live runs.
 *
 * Ticket length is an input-cost control: the ticket goes into every prompt in
 * the run, so a large one is paid for three times over. The domain schema
 * deliberately stays permissive, because this is a policy about what a public
 * deployment will spend, not a claim about what a valid ticket is.
 */

export const MAX_LIVE_TICKET_CHARS = 6000;

/**
 * Most a single live run may be estimated to cost.
 *
 * Expressed as money rather than a model allowlist so the policy survives new
 * models: the default admits Haiku and excludes Sonnet and Opus, and raising
 * it locally is one env var.
 */
export const DEFAULT_MAX_RUN_COST_USD = 0.05;

export function maxRunCostUsd(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.LIVE_MAX_RUN_COST_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_RUN_COST_USD;
}

export function ticketSize(ticket: Ticket): number {
  return (
    ticket.title.length +
    ticket.description.length +
    ticket.acceptanceCriteria.join("").length +
    ticket.labels.join("").length
  );
}

export type LiveCheck = { ok: true } | { ok: false; error: string };

export function checkTicketSize(ticket: Ticket): LiveCheck {
  const size = ticketSize(ticket);
  if (size > MAX_LIVE_TICKET_CHARS) {
    return {
      ok: false,
      error: `Ticket is ${size} characters; live runs are limited to ${MAX_LIVE_TICKET_CHARS}. The ticket is included in every prompt, so a long one is paid for on each call.`,
    };
  }
  return { ok: true };
}

export function checkModelAffordable(
  model: string,
  env: NodeJS.ProcessEnv = process.env,
): LiveCheck {
  const selectable = getSelectableModel(model);
  if (!selectable) return { ok: false, error: "Unsupported model" };

  const ceiling = maxRunCostUsd(env);
  if (selectable.approxRunCostUsd > ceiling) {
    return {
      ok: false,
      error: `${selectable.label} costs about $${selectable.approxRunCostUsd.toFixed(3)} per run, above this deployment's per-run limit of $${ceiling.toFixed(3)}. Choose a cheaper model.`,
    };
  }
  return { ok: true };
}

/** Estimated cost of one run on this model, used to reserve budget up front. */
export function estimateRunCostUsd(model: string): number {
  return getSelectableModel(model)?.approxRunCostUsd ?? DEFAULT_MAX_RUN_COST_USD;
}
