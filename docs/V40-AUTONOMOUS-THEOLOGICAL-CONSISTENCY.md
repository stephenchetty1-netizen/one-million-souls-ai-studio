# V40 — Autonomous Theological Consistency Agent

## Purpose
V40 adds an independent challenge layer between content generation and production. Scripture Intelligence researches the biblical foundation; the Theological Consistency Agent then audits the finished content against that foundation.

## Gate
`POST /api/theology/consistency` is protected by `CRON_SECRET` and returns a structured review. Autonomous production proceeds only when:

- status is `PASS`
- Scripture faithfulness is true
- contextual faithfulness is true
- Gospel-centeredness is true
- theological clarity is true
- application/inference is properly distinguished

`REVISE` and `BLOCK` both fail closed.

## Workflow

MISSION → STRATEGY → DECISION → SCRIPTURE INTELLIGENCE → CREATE → QUALITY → **THEOLOGICAL CONSISTENCY** → FACTORY → VIDEO → DISTRIBUTION → LEARN

## Guardrails
The agent is a consistency checker, not a replacement for Scripture, pastoral care, or accountable theological leadership. It cannot authorize fabricated testimony, fabricated quotations, spiritual guarantees, manipulative fear, or unsupported theological claims.

## Persistence
Latest review: `one-million-souls:theology:consistency:latest`

## Scheduled check
`GET /api/cron/theology` verifies that the latest decision and Scripture Intelligence record are available. The actual content review is performed in the orchestrator after generation.
