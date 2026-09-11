# V38 — Autonomous Agent Memory

## Purpose
V38 gives the Christian Content AI Studio durable institutional memory: what was tried, what happened, what appears to work, what underperformed, and what the system should test next.

## Memory model
- WIN — evidence of strong reach plus retention.
- LOSS — underperformance relative to the current baseline.
- PATTERN — reusable evidence-backed behavior.
- DECISION — the latest strategic decision and its evidence.
- GUARDRAIL — permanent constraints that memory cannot override.

## Storage
Latest snapshot: `one-million-souls:agent-memory:latest` in Upstash Redis.

## Scheduled refresh
`/api/cron/memory` runs at 10:30 UTC.

## Safety
Memory only uses aggregate/public performance and system outputs. It does not store private messages, sensitive traits, salvation claims, or fabricated spiritual outcomes. Memory is advisory and cannot bypass biblical, safety, rights, platform, or final-video quality gates.
