# V37 — Autonomous Agent Supervisor

V37 adds a coordination layer above the specialist agents. It does not replace the specialists; it verifies their availability, dependency order, conflicts, and execution readiness before the orchestrator proceeds.

## Specialist order

MISSION → CAMPAIGN → PROGRAMMING → DECISION → CREATIVE → PRODUCTION → DISTRIBUTION → ANALYTICS

## Supervisor actions

- EXECUTE — dependencies and gates are healthy.
- RESEARCH — controlled exploration is appropriate.
- WAIT_FOR_DATA — evidence is below the confidence threshold.
- REPAIR — specialists have conflicting or incomplete state; orchestration stops.
- BLOCK — a hard dependency or Mission Control gate prevents autonomous execution.

## Conflict policy

The supervisor does not override biblical, safety, rights, platform, or final-video quality gates. When signals conflict, the system chooses the least-assumptive safe action and fails closed rather than guessing.

## Persistence

Snapshot key: `one-million-souls:agent-supervisor:latest`

Endpoint: `POST /api/supervisor`

Cron: `POST /api/cron/supervisor`

Autopilot remains disabled by default through `AUTOPILOT_ENABLED=false`.
