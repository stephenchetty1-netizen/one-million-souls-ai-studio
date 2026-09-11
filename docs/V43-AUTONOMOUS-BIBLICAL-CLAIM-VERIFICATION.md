# V43 — Autonomous Biblical Claim Verification

V43 adds claim-level verification between Scripture intelligence and theological consistency.

## Flow
Scripture Intelligence → Claim Verification → Citation Audit → Theological Consistency → Quality → Production

## Verdicts
- SUPPORTED
- PARTIAL
- UNSUPPORTED
- REJECTED

## Fail-closed rules
Invalid structured output, rejected claims, or material unsupported claims block autonomous progression.

## API
`POST /api/knowledge/claims` — protected by `CRON_SECRET`.
`GET /api/cron/claim-verification` — protected by `CRON_SECRET`.

## Persistence
`one-million-souls:knowledge:claim-verification:latest`

This layer supports biblical verification; it is not a replacement for pastoral/theological judgment and cannot override Scripture or downstream safety/quality gates.
