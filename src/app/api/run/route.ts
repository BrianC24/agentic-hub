import { NextResponse } from "next/server";
import { guardLiveRun, guardStatus } from "@/lib/guardrails";
import { createAnthropicProvider, readLlmConfig } from "@/lib/llm/config";
import { isSelectableModel, resolveModel, SELECTABLE_MODELS } from "@/lib/llm/models";
import type { ModelProvider } from "@/lib/llm/types";
import { createReplayProvider, hasRecording } from "@/lib/replay";
import { parseTicket } from "@/lib/ticket/schema";
import { runWorkflow } from "@/lib/workflow/orchestrator";
import { newRunId, runStore } from "@/lib/workflow/store";

/**
 * Starts a workflow run.
 *
 * Provider selection is deliberately conservative: a request may ask for
 * replay, but it can never *escalate* itself to the live API. Live calls
 * happen only when the server is configured for them, so a public deployment
 * cannot be made to spend money by a crafted request body.
 */

export const runtime = "nodejs";
/** Live runs take ~30s across four model calls. */
export const maxDuration = 120;

interface RunRequestBody {
  ticket?: unknown;
  fixtureKey?: unknown;
  mode?: unknown;
  model?: unknown;
}

export async function POST(request: Request) {
  let body: RunRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  // Model output is untrusted, and so is the client. Same treatment.
  const parsed = parseTicket(body.ticket);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ticket failed validation", violations: parsed.errors },
      { status: 400 },
    );
  }

  const config = readLlmConfig();
  const wantsLive = body.mode === "live";
  const fixtureKey = typeof body.fixtureKey === "string" ? body.fixtureKey : null;

  let provider: ModelProvider;
  let mode: "replay" | "live";

  // An allowlist, not a passthrough: an arbitrary model string from a request
  // would hand the caller control over spend.
  if (body.model !== undefined && !isSelectableModel(body.model)) {
    return NextResponse.json(
      {
        error: `Unsupported model. Choose one of: ${SELECTABLE_MODELS.map((m) => m.id).join(", ")}`,
      },
      { status: 400 },
    );
  }
  const requestedModel = resolveModel(body.model, config.model);

  let settle: ((actual: number | null) => void) | null = null;
  let release: (() => void) | null = null;

  if (wantsLive && config.provider === "anthropic") {
    // Every live guard in one place, checked before a provider exists so a
    // refused request cannot reach the network.
    const guard = guardLiveRun(request, parsed.ticket, requestedModel);
    if (!guard.ok) {
      return NextResponse.json(
        { error: guard.error },
        {
          status: guard.status,
          headers: guard.retryAfterSeconds
            ? { "Retry-After": String(guard.retryAfterSeconds) }
            : undefined,
        },
      );
    }
    settle = guard.settle;
    release = guard.release;

    try {
      provider = createAnthropicProvider(process.env, requestedModel);
      mode = "live";
    } catch (error) {
      release();
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Provider unavailable" },
        { status: 503 },
      );
    }
  } else if (fixtureKey && hasRecording(fixtureKey)) {
    provider = createReplayProvider(fixtureKey);
    mode = "replay";
  } else {
    return NextResponse.json(
      {
        error: config.provider === "anthropic"
          ? "No replay recording for this ticket. Load one of the example tickets, or enable live model calls to run it for real."
          : "No replay recording for this ticket, and this deployment does not make live model calls. Load one of the example tickets to see a recorded run.",
      },
      { status: 409 },
    );
  }

  try {
    const runId = newRunId();
    const result = await runWorkflow(provider, parsed.ticket, { runId });
    // Reconcile the reservation against what the run actually cost.
    settle?.(result.totals.estimatedCostUsd);

    // Only a run that can still be decided on is worth holding. Storing the
    // artifacts server-side is what keeps the repair bound enforceable — the
    // client never gets to tell us how many rounds it has already used.
    if (result.run.stage === "awaiting_approval") {
      runStore.save(runId, {
        run: result.run,
        artifacts: result.artifacts,
        ticket: parsed.ticket,
      });
    }

    return NextResponse.json({ mode, model: provider.model, runId, ...result });
  } catch (error) {
    // The run never completed, so hand the held budget back rather than
    // charging for calls that may not have happened.
    release?.();
    // A thrown error here is a bug in the workflow, not a model failure —
    // model failures are represented as a failed run, not an exception.
    console.error("Workflow crashed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workflow failed" },
      { status: 500 },
    );
  }
}

/** Tells the client which modes this deployment actually supports. */
export async function GET(request: Request) {
  const config = readLlmConfig();
  const live = config.provider === "anthropic";
  return NextResponse.json({
    liveEnabled: live,
    ...(live ? guardStatus(request) : {}),
    model: config.model,
    models: SELECTABLE_MODELS,
    defaultModel: resolveModel(undefined, config.model),
  });
}
