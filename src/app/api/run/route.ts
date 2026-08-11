import { NextResponse } from "next/server";
import { createAnthropicProvider, readLlmConfig } from "@/lib/llm/config";
import { isSelectableModel, resolveModel, SELECTABLE_MODELS } from "@/lib/llm/models";
import type { ModelProvider } from "@/lib/llm/types";
import { createReplayProvider, hasRecording } from "@/lib/replay";
import { parseTicket } from "@/lib/ticket/schema";
import { runWorkflow } from "@/lib/workflow/orchestrator";

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

  if (wantsLive && config.provider === "anthropic") {
    try {
      provider = createAnthropicProvider(process.env, requestedModel);
      mode = "live";
    } catch (error) {
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
    const result = await runWorkflow(provider, parsed.ticket);
    return NextResponse.json({ mode, model: provider.model, ...result });
  } catch (error) {
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
export async function GET() {
  const config = readLlmConfig();
  return NextResponse.json({
    liveEnabled: config.provider === "anthropic",
    model: config.model,
    models: SELECTABLE_MODELS,
    defaultModel: resolveModel(undefined, config.model),
  });
}
