# V20 — Autonomous Media Director

V20 adds a media-direction layer between creative intelligence/content and rendering.

## Responsibilities
- Define opening frame and visual style.
- Produce a short scene-by-scene production plan.
- Define on-screen text and narration intent.
- Give platform-specific creative notes for TikTok and YouTube Shorts.
- Provide cover/thumbnail direction.
- Keep media rights, Scripture accuracy, safety and truthful claims as hard guardrails.

## Endpoint
`POST /api/media/director` with `x-cron-secret`.

The endpoint creates a deterministic production direction. A future renderer adapter can consume this contract without changing the biblical quality gate.

## Principle
Creative direction optimizes communication, not theology. Verified Scripture and the quality gate remain authoritative.
