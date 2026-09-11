# V19 — Adaptive Campaign Intelligence

V19 closes the campaign feedback loop. The campaign executor checks recent normalized analytics before selecting the next unfinished episode.

## Signal logic
- Fewer than 6 recent records: `INSUFFICIENT_DATA`; preserve the plan.
- Composite improvement above 8%: `IMPROVING`; preserve direction with small refinements.
- Composite decline below -8%: `DECLINING`; change hook/format while preserving theme and biblical core.
- Otherwise: `STABLE`; retain the plan and test one controlled presentation change.

The composite combines recent-vs-prior changes in retention, engagement rate, and follow rate. It is a decision heuristic, not a causal attribution model.

## Guardrails
Adaptation only changes campaign presentation fields. It cannot alter the biblical quality gate or publish directly. Existing orchestrator, rendering, platform, and Metricool safeguards remain authoritative.
