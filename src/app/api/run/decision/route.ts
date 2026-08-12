import { NextResponse } from "next/server";
import { guardLiveRun } from "@/lib/guardrails";
import { createAnthropicProvider, readLlmConfig } from "@/lib/llm/config";
import { isSelectableModel, resolveModel } from "@/lib/llm/models";
import { approveRun, replanAfterRejection } from "@/lib/workflow/replan";
import { newRunId, runStore } from "@/lib/workflow/store";
import { summarizeTotals } from "@/lib/workflow/totals";

/**
 * Records a human decision on a plan.
 *
 * The caller supplies only a run id. The run, its artifacts, and its repair
 * count are read from the server-side store, so the bound cannot be bypassed
 * by a crafted request and no client-supplied text reaches the next prompt.
 *
 * Approving is a pure state transition and costs nothing. Rejecting runs a
 * genuine replan with the reviewer's note as feedback, so it needs a live
 * provider — a recording cannot cover a round that exists only because a
 * person asked for it.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

/** Bounds what a reviewer's note can add to the next prompt. */
const MAX_NOTE_LENGTH = 2000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const decision = payload.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json(
      { error: "decision must be 'approved' or 'rejected'" },
      { status: 400 },
    );
  }

  const runId = payload.runId;
  if (typeof runId !== "string" || runId.length === 0 || runId.length > 100) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 });
  }

  const note = typeof payload.note === "string" ? payload.note.slice(0, MAX_NOTE_LENGTH) : "";

  const stored = runStore.get(runId);
  if (!stored) {
    return NextResponse.json(
      {
        error:
          "That run is no longer available. Runs are held in memory for 30 minutes and do not survive a restart — start a new run.",
      },
      { status: 404 },
    );
  }

  if (stored.run.stage !== "awaiting_approval") {
    return NextResponse.json(
      { error: `This run is ${stored.run.stage}, so there is nothing to decide` },
      { status: 409 },
    );
  }

  if (decision === "approved") {
    const approved = approveRun(stored.run, note);
    // Terminal: drop it rather than leaving a decided run occupying the store.
    runStore.delete(runId);
    return NextResponse.json({
      mode: "none",
      // No model was called to approve, so there is nothing to attribute.
      model: "—",
      runId,
      run: approved,
      artifacts: stored.artifacts,
      totals: summarizeTotals(stored.artifacts.stageRuns),
    });
  }

  const config = readLlmConfig();
  if (config.provider !== "anthropic") {
    return NextResponse.json(
      {
        error:
          "Rejecting a plan triggers a genuine replan, which needs live model calls. " +
          "This deployment runs on recordings only — a recording cannot cover a round that exists because a reviewer asked for it.",
      },
      { status: 409 },
    );
  }

  if (payload.model !== undefined && !isSelectableModel(payload.model)) {
    return NextResponse.json({ error: "Unsupported model" }, { status: 400 });
  }

  // A replan is a live run and is guarded identically. Without this, rejection
  // would be an unmetered way to spend the budget the run endpoint protects.
  const replanModel = resolveModel(payload.model, config.model);
  const guard = guardLiveRun(request, stored.ticket, replanModel);
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

  try {
    const provider = createAnthropicProvider(process.env, replanModel);
    const result = await replanAfterRejection({
      provider,
      // The ticket comes from the store too, so a decision cannot smuggle in a
      // different ticket than the one the run was created from.
      ticket: stored.ticket,
      run: stored.run,
      artifacts: stored.artifacts,
      note,
    });

    guard.settle(result.totals.estimatedCostUsd);

    const nextId = result.run.stage === "awaiting_approval" ? newRunId() : null;
    if (nextId) {
      runStore.save(nextId, {
        run: result.run,
        artifacts: result.artifacts,
        ticket: stored.ticket,
      });
    }
    runStore.delete(runId);

    return NextResponse.json({ mode: "live", model: provider.model, runId: nextId, ...result });
  } catch (error) {
    guard.release();
    console.error("Replan failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Replan failed" },
      { status: 500 },
    );
  }
}
