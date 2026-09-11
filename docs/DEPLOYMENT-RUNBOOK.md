# One Million Souls — Production Deployment Runbook

## 1. Deploy
- Import the project into Vercel.
- Use Node.js 20+.
- Add all values from `.env.example` as Vercel environment variables.
- Never commit `.env` files or API keys.

## 2. Required services
- OpenAI API key
- Upstash Redis REST URL/token
- Metricool REST credentials and the correct analytics adapter if analytics sync is enabled
- A real video-renderer webhook that returns `{ "mediaUrl": "https://..." }`

## 3. Readiness
Keep `AUTOPILOT_ENABLED=false`.
Call `/api/ready` with `Authorization: Bearer $CRON_SECRET`.
All required checks must pass.

## 4. Dry run
Run one generation and renderer test without scheduling a public post. Verify:
- Scripture research exists.
- Quality gate returns PASS.
- Renderer returns a public media URL.
- Experiment metadata is preserved when an experiment is active.
- Metricool receives the intended draft/scheduled payload only when explicitly testing scheduling.
- No duplicate job is created if the same cron invocation is repeated.

## 5. Enablement
Only after the dry run succeeds, set `AUTOPILOT_ENABLED=true` in the production environment and redeploy.

## 6. Rollback
Set `AUTOPILOT_ENABLED=false` immediately if unexpected content, duplicate scheduling, renderer failures, analytics corruption, or integration errors appear. Then redeploy and inspect logs before re-enabling.

## 7. Operational rule
The system should publish only when every automated gate passes. If a required dependency fails, it should stop rather than guess, fabricate, or publish incomplete content.
