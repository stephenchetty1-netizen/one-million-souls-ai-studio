# V12 — Intelligent Publishing Engine

V12 adds a platform-optimization layer between content generation and Metricool scheduling.

## Pipeline

Idea → Bible research → writer → quality gate → platform optimizer → video render → media validation → Metricool → TikTok + YouTube → analytics → learning.

## Platform packaging

The optimizer creates separate TikTok and YouTube packages while preserving the same Scripture-grounded message. It normalizes hashtags, keeps titles within configured limits, and validates required metadata.

## Safety

- Scripture and quality gates remain authoritative.
- Platform optimization cannot rewrite or override Bible research.
- Publishing remains server-side and secret-protected.
- `AUTOPILOT_ENABLED=false` remains the safe default.
- A platform validation failure blocks the daily job before scheduling.

## Protected endpoint

`POST /api/platform` returns the optimized TikTok/YouTube packages for an authorized request. It does not publish.

## Launch rule

Do not enable autonomous publishing until the full dry run succeeds, including renderer output, platform validation, Metricool scheduling test, analytics ingestion, and duplicate-job protection.
