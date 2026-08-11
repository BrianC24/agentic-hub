import { NextResponse } from "next/server";
import { createAnthropicProvider, readLlmConfig } from "@/lib/llm/config";
import { isSelectableModel, resolveModel } from "@/lib/llm/models";
import { parseTicket } from "@/lib/ticket/schema";
import type { RunArtifacts, WorkflowResult } from "@/lib/workflow/orchestrator";
import { approveRun, replanAfterRejection } from "@/lib/workflow/replan";
import type { Run } from "@/lib/workflow/run";

/**
 * Records a human decision on a plan.
 *
 * Approving is a pure state transition and costs nothing. Rejecting runs a
 * genuine replan with the reviewer's note as feedback, so it needs a live
 * provider — a recording cannot cover a round that only exists because a
 * person asked for it.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

interface DecisionBody {
  decision?: unknown;
  note?: unknown;
  ticket?: unknown;
  run?: unknown;
  artifacts?: unknown;
  model?: unknown;
}

export async function POST(request: Request) {
  let body: DecisionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json(
      { error: "decision must be 'approved' or 'rejected'" },
      { status: 400 },
    );
  }

  const note = typeof body.note === "string" ? body.note.slice(0, 2000) : "";

  const parsedTicket = parseTicket(body.ticket);
  if (!parsedTicket.success) {
    return NextResponse.json(
      { error: "Ticket failed validation", violations: parsedTicket.errors },
      { status: 400 },
    );
  }

  // The run and artifacts come back from the client because there is no store.
  // That is a real limitation, not a design choice — see the README. It is
  // acceptable here only because nothing downstream trusts them: the workflow
  // re-derives every conclusion from the model output it fetches.
  const run = body.run as Run | undefined;
  const artifacts = body.artifacts as RunArtifacts | undefined;
  if (!run || !artifacts || run.stage !== "awaiting_approval") {
    return NextResponse.json(
      { error: "A run awaiting approval must be supplied" },
      { status: 400 },
    );
  }

  if (decision === "approved") {
    const approved = approveRun(run, note);
    const result: WorkflowResult = {
      run: approved,
      artifacts,
      totals: {
        usage: artifacts.stageRuns.reduce(
          (acc, r) => ({
            inputTokens: acc.inputTokens + r.usage.inputTokens,
            outputTokens: acc.outputTokens + r.usage.outputTokens,
          }),
          { inputTokens: 0, outputTokens: 0 },
        ),
        latencyMs: artifacts.stageRuns.reduce((acc, r) => acc + r.latencyMs, 0),
        estimatedCostUsd: artifacts.stageRuns.reduce(
          (acc, r) => (acc === null || r.estimatedCostUsd === null ? null : acc + r.estimatedCostUsd),
          0 as number | null,
        ),
        modelCalls: artifacts.stageRuns.reduce((acc, r) => acc + r.attempts, 0),
      },
    };
    return NextResponse.json({ mode: "none", model: "n/a", ...result });
  }

  // Rejection means real work, which means a live provider.
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

  if (body.model !== undefined && !isSelectableModel(body.model)) {
    return NextResponse.json({ error: "Unsupported model" }, { status: 400 });
  }

  try {
    const provider = createAnthropicProvider(process.env, resolveModel(body.model, config.model));
    const result = await replanAfterRejection({
      provider,
      ticket: parsedTicket.ticket,
      run,
      artifacts,
      note,
    });
    return NextResponse.json({ mode: "live", model: provider.model, ...result });
  } catch (error) {
    console.error("Replan failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Replan failed" },
      { status: 500 },
    );
  }
}
