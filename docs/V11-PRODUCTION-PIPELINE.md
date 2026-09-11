# V11 — Automated Content Production Pipeline

V11 adds a protected end-to-end dry-run pipeline that generates a campaign, requires the biblical/safety quality gate to pass, and sends the campaign to the configured video renderer. It never publishes or schedules a post.

## Flow

Idea → Bible research → Writer → Quality gate → Video render → HTTPS media URL → ready for platform scheduling

## Dry run

Keep `AUTOPILOT_ENABLED=false`. Call `POST /api/dry-run` with `Authorization: Bearer <CRON_SECRET>`.

Optional JSON body:
`{"topic":"Jesus is with you in the storm"}`

A successful response proves generation, quality gating, and rendering are wired together. It does **not** prove TikTok/YouTube publishing.

## Production rule

Metricool scheduling remains a separate controlled step until the renderer and platform credentials are verified. Never enable autopilot merely because the dry-run endpoint responds successfully.
