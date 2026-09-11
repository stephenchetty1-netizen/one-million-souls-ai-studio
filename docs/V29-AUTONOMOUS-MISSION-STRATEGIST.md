# V29 — Autonomous Mission Strategist

V29 adds a mission-level strategy layer above individual content decisions.

## Purpose

Translate the One Million Souls mission into a seasonal content strategy: audience, primary pillar, campaign theme, recurring series, priorities, experiments, and guardrails.

## Decision hierarchy

Mission → Season → Audience → Pillars → Campaign Theme → Series → Experiments → Episodes → Individual Posts

## Safeguards

The strategist may optimize presentation, sequencing, format, and distribution. It must not optimize away biblical truth, fabricate spiritual outcomes, or use private audience data.

## API

`POST /api/mission` — protected with `Authorization: Bearer CRON_SECRET`.

`GET /api/cron/mission` — protected scheduled strategy refresh.

## Persistence

Latest strategy is stored in Upstash under:

`one-million-souls:mission:strategy:latest`

## Production note

V29 creates strategic decisions; it does not claim that a person has encountered Jesus, converted, or been discipled merely because a post received engagement. Those are not valid analytics outcomes.
