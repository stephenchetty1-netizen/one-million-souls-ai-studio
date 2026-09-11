# V36 — Autonomous Mission Control Center

V36 adds an operational control plane over the One Million Souls content system. It aggregates mission strategy, campaign architecture, programming calendar, next-content decisions, public performance signals, and post-publish intelligence into one persisted snapshot.

## Endpoints
- `GET|POST /api/mission-control` — protected control snapshot endpoint.
- `GET|POST /api/cron/mission-control` — protected scheduled refresh.

## Persistence
`one-million-souls:mission-control:latest`

## Status model
- `READY`: required execution foundations are present and evidence is usable.
- `ATTENTION`: execution can continue but one or more configuration/evidence alerts exist.
- `INSUFFICIENT_DATA`: the system deliberately waits for more measured posts.
- `BLOCKED`: critical execution dependency is missing.

## Next-action model
- `CREATE`
- `TEST`
- `WAIT_FOR_DATA`
- `BLOCKED`

## Orchestrator integration
The content orchestrator now consults Mission Control before creating content. A blocked control state fails closed. Mission Control does not bypass any downstream biblical, safety, rights, platform, rendering, or final-quality gates.

## Safety and privacy
Only aggregate/public performance signals are used. No private messages, contact information, or sensitive audience profiling is used. Performance is never treated as evidence of salvation or spiritual transformation.
