# V18 — Campaign Execution Engine

V18 turns the V17 campaign plan into a durable execution loop.

## What it does

1. Loads the active campaign from Upstash Redis.
2. Creates a new campaign when no active campaign exists or the prior campaign is complete.
3. Selects the first unscheduled episode.
4. Claims a campaign+episode job for idempotency.
5. Passes the episode topic, pillar, hook direction, format, objective, campaign ID, and episode ID into the existing orchestrator.
6. Requires every existing quality, platform, renderer, and publishing gate to pass.
7. Marks the episode scheduled only after successful publishing.
8. Moves to the next episode on the next execution cycle.

## Endpoint

`POST /api/campaign/execute`

Requires `Authorization: Bearer $CRON_SECRET`.

## Persistence

Autonomous execution requires Upstash Redis. In-memory state is intentionally not used for campaign progress because losing state could cause duplicate publishing.

## Safety and truth hierarchy

Campaign objectives and performance strategy never outrank Scripture verification, biblical consistency, safety, honesty, platform compliance, or media validation.
