# V26 — Autonomous Distribution & Platform Intelligence

V26 adds a platform-aware distribution layer after final video quality approval.

## Flow

BRAIN → CREATIVE → GENERATE → QUALITY → FACTORY → MEDIA → VIDEO PLAN → ASSETS → ASSEMBLY → RENDER → FINAL QUALITY → DISTRIBUTION → METRICOOL → TIKTOK + YOUTUBE → LEARN

## Distribution plan

`lib/distribution-intelligence.ts` builds and validates a V26 distribution plan with:

- publication time and timezone
- separate TikTok and YouTube packages
- platform-specific hook/caption/title/CTA guidance
- AI-generated-content disclosure requirements
- verification requirements
- safety and rights guardrails

## Publishing

`POST /api/distribution/publish` is protected by `PUBLISH_SECRET` (or `CRON_SECRET`) and uses the existing Metricool adapter. No undocumented platform-specific publishing API is assumed.

The route only reports `scheduled: true` after the configured Metricool request returns an HTTP success response.

## Important limitation

This version verifies the provider scheduling request, not that a platform has subsequently made the post publicly live. A future provider-specific reconciliation adapter can add post-publication verification when supported by the connected service.

## Safety

Distribution remains downstream of the biblical, safety, platform, asset, assembly, and final-video quality gates. Any failed gate blocks publication.
