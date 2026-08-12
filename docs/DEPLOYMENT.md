# Deployment

The demo is designed to be deployed **without an API key**. In that
configuration it runs the genuine workflow against recorded responses, and
cannot make a billable call no matter what a request asks for.

## Recommended: replay-only public deploy

1. Push to GitHub (already done).
2. In Vercel: **Add New → Project → import `agentic-hub`**.
3. Framework preset: **Next.js**. Leave build settings at their defaults.
4. **Set no environment variables.**
5. Deploy.

That is the whole process. `LLM_PROVIDER` defaults to `mock`, so:

- `GET /api/run` reports `liveEnabled: false`, and the UI shows "Replay mode"
  with no model picker.
- A request asking for `mode: "live"` falls back to replay rather than erroring
  or spending.
- Rejecting a plan — the one action that needs a live call — is refused with an
  explanation.

Verified against a production build with the environment stripped:

```
liveEnabled: false
mode=live + claude-opus-5 requested  ->  served as replay
rejection                            ->  refused
replay run                           ->  awaiting_approval, $0.0170 (recorded)
```

Visitors can run the three example tickets end to end, see the full trace, and
approve a plan. Only rejection is unavailable, because a recording cannot cover
a round that exists because a reviewer asked for it.

## Optional: live-enabled deploy

Only do this if you want to demo live calls, and understand it spends money on
every run from any visitor.

| Variable | Value |
|---|---|
| `LLM_PROVIDER` | `anthropic` |
| `ANTHROPIC_API_KEY` | your key |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` (seeds the picker) |

Live runs are guarded, and the guards are on by default:

| Guard | Default | Env var |
|---|---|---|
| Daily spend ceiling | $2 | `LIVE_DAILY_BUDGET_USD` |
| Live runs per caller per hour | 5 | `LIVE_RUNS_PER_HOUR` |
| Max estimated cost of one run | $0.05 (Haiku only) | `LIVE_MAX_RUN_COST_USD` |
| Max ticket length for a live run | 6,000 chars | — |

Budget is **reserved before the call and reconciled after**, so the request
that would break the ceiling is refused rather than discovered afterwards. A
refused request does not consume the caller's rate-limit quota.

What these do not do, stated plainly:

- **There is still no authentication.** Anyone with the URL can spend up to the
  daily ceiling. The ceiling bounds the damage to an amount you chose; it does
  not prevent the spending.
- **The ledger and rate limiter are in-memory.** Across multiple serverless
  instances each holds its own, so the effective ceiling is the configured
  amount times the instance count. Low-traffic deployments usually run one
  instance, but the only correct fix is shared storage.
- **`x-forwarded-for` is only trustworthy behind a proxy that sets it.**
  Without one, every caller collapses to a single shared quota — the safe
  failure, but not per-caller fairness.

Keep auto-reload off on the API key regardless. That balance is the last
backstop and the only one outside this codebase.

## Timeouts

Live runs take ~30s (Haiku) to ~100s (Opus) across three model calls. Both API
routes declare `maxDuration = 120`. Vercel's Hobby tier caps serverless
functions at 60s, so a live Opus run would be cut off there — another reason the
public deployment is replay-only.

## After deploying

- Confirm `GET /api/run` reports `liveEnabled: false`.
- Run each of the three example tickets.
- Add the URL to the README.
