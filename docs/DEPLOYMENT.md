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

Before doing this, understand the exposure: **there is no authentication and no
rate limiting.** Anyone with the URL can trigger runs at roughly $0.02 each on
Haiku, or $0.22 on Opus. The only real protection is the credit balance on the
key, so keep auto-reload off and fund it with an amount you would not mind
losing.

A better shape, if live demoing matters: deploy replay-only in public, and run
live locally when screen-sharing.

## Timeouts

Live runs take ~30s (Haiku) to ~100s (Opus) across three model calls. Both API
routes declare `maxDuration = 120`. Vercel's Hobby tier caps serverless
functions at 60s, so a live Opus run would be cut off there — another reason the
public deployment is replay-only.

## After deploying

- Confirm `GET /api/run` reports `liveEnabled: false`.
- Run each of the three example tickets.
- Add the URL to the README.
