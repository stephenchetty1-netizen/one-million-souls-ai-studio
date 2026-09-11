# V16 — Autonomous Content Orchestrator

V16 coordinates the existing Growth Brain, Creative Intelligence, content generation, quality gates, Content Factory, video renderer, and Metricool publishing into one server-side stateful workflow.

## Flow

`DECIDE → CREATE → TEST/PACKAGE → QUALITY → FACTORY → RENDER → PUBLISH → LEARN`

## Endpoint

`GET/POST /api/orchestrate` is protected by `CRON_SECRET` and requires an HTTPS `APP_URL` in production.

The legacy `/api/cron/daily` route remains as a compatibility wrapper, while `vercel.json` now schedules `/api/orchestrate` directly.

## Safety and reliability

- Persistent job claims prevent the same orchestration slot from running twice concurrently.
- A failed run releases the claim so the next scheduled attempt can retry.
- No render or publish occurs unless the campaign passes biblical and platform validation.
- The renderer must return an HTTPS `mediaUrl`.
- The core factory asset is selected by default; alternate assets remain attributable for later experiments.
- Server-side secrets are never sent to the browser.
- This system optimizes for sustainable reach and learning; it does not guarantee virality or follower counts.

## Production requirement

Keep `AUTOPILOT_ENABLED=false` until the full chain has been dry-run and verified in the deployed environment. Then enable it only after OpenAI, persistent storage, renderer, Metricool, and cron authentication all pass readiness checks.
