# V27 — Autonomous Post-Publish Intelligence

## Purpose
Turn publishing outcomes and public analytics into actionable next-content decisions without pretending that scheduling success equals public publication.

## Data contract
Use `PerformanceRecord` from the existing learning store. Records should come from a verified analytics adapter or protected analytics ingest. V27 uses views, likes, comments, shares, follows, retention, platform, topic and pillar.

## Decision rules
- Fewer than 3 comparable posts: no winner declaration.
- Composite >= +20% vs comparable median: WINNER.
- Composite <= -20%: NEEDS_ADAPTATION.
- Otherwise: STABLE/MEASURED.
- Recommendations change one major creative variable at a time.

## Safety and privacy
Only public performance signals are used. Do not ingest private messages, names, contact details or sensitive audience information. Biblical quality gates remain upstream and are not replaced by performance optimization.

## Production note
Actual public-live verification requires a supported provider status/analytics adapter. Do not infer it from the scheduler response alone.
