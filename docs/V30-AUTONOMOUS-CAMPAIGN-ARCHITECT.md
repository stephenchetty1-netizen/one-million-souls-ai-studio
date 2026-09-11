# V30 — Autonomous Campaign Architect

V30 converts mission-level strategy into a multi-week campaign architecture.

## Flow

MISSION → SEASON → AUDIENCE NEED → JOURNEY → CAMPAIGN THEME → EPISODES → EXPERIMENTS → METRICS → ADAPTATION

## Audience journey

1. DISCOVER — earn attention around a real need without sensationalism.
2. CONNECT — connect that need to biblical truth and Jesus.
3. DEEPEN — move viewers toward Scripture, prayer, understanding, and a practical faith step.
4. INVITE — offer a meaningful next step toward Jesus and discipleship.

## Campaign design

The architecture defaults to 14 days and can be configured between 3 and 14 days through the underlying campaign planner. Each episode receives a journey phase and phase-specific CTA guidance.

## Experiment allocation

V30 balances exploitation of proven patterns with exploration. EXPLORE decisions reserve more capacity for testing; EXPLOIT decisions reserve less. The system never changes biblical truth to improve performance.

## Metrics

- retention
- engagement
- follow rate
- series continuity

These are communication/distribution signals, not measures of salvation or spiritual transformation.

## Adaptation

V30 preserves improving patterns, changes one major variable when evidence is weak or declining, and expands strong series without duplicating exact posts.

## Persistence

Latest architecture is stored at:

`one-million-souls:campaign:architecture:latest`

## Endpoints

- `POST/GET /api/campaign/architecture`
- `POST/GET /api/cron/campaign-architecture`

Both require `Authorization: Bearer $CRON_SECRET`.

## Production safety

`AUTOPILOT_ENABLED` remains the master publishing control. The campaign architect itself only plans; final biblical, safety, platform, video-quality, and distribution gates remain downstream.
