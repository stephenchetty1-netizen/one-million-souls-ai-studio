# V14 — Autonomous Content Factory

V14 turns one approved campaign into a reusable batch of three packaging assets while keeping one Bible-grounded core script authoritative.

## Flow
Growth Brain → Generation → Bible/Quality Gate → Content Factory → Platform Packages → Video Render → Metricool → TikTok + YouTube → Analytics.

## Factory assets
- CORE — original approved packaging.
- HOOK_FOCUSED — stronger opening/title packaging without changing the approved script.
- QUESTION_FOCUSED — question-led packaging without introducing new biblical claims.

The factory does not create a second unverified theological message. Every asset inherits the same approved core script, visual concept and image prompts. This keeps experimentation focused on packaging rather than changing Scripture after the quality gate.

## Protected endpoint
`POST /api/factory` creates and validates a factory batch from an already approved campaign. It requires `ANALYTICS_INGEST_SECRET` or `CRON_SECRET`.

## Autopilot
The daily pipeline now builds a factory batch after the campaign passes the quality and platform gates. The CORE asset is selected by default for scheduling, while the alternate assets are returned with the batch for later experimentation.

This is an optimization system, not a guarantee of virality. Performance data should determine which packaging direction wins over time.
