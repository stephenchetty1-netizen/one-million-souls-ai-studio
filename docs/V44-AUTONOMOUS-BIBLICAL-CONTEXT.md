# V44 — Autonomous Biblical Context Agent

V44 adds a dedicated context-review gate covering four dimensions:

1. Literary context
2. Historical context
3. Grammatical context
4. Immediate passage context

The agent uses public web evidence when appropriate, distinguishes observation from interpretation/application, and fails closed on material contextual uncertainty or misalignment.

## Endpoint
- `POST /api/knowledge/context` — protected by `Bearer CRON_SECRET`
- `GET /api/cron/context` — protected by `Bearer CRON_SECRET`

## Persistence
`one-million-souls:knowledge:biblical-context:latest`

## Guardrail
This layer is an evidence/review assistant, not a replacement for Scripture, qualified pastoral/theological judgment, or responsible study. It cannot bypass citation, theological, safety, rights, or quality gates.
