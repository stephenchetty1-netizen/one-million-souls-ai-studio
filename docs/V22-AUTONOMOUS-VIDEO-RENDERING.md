# V22 — Autonomous Video Rendering Pipeline

V22 connects the V20 media direction layer to an explicit renderer contract.

## Flow

`APPROVED CAMPAIGN → FACTORY ASSET → MEDIA DIRECTION → VIDEO PRODUCTION MANIFEST → RENDERER → HTTPS MEDIA URL → PUBLISH`

## Production manifest

The manifest contains:
- 9:16 short-form specification
- scene timing and visual prompts
- narration direction
- on-screen text
- burned-in caption requirements
- audio direction
- cover concept
- TikTok and YouTube packages
- rights and AI-disclosure flags
- content guardrails

## Renderer contract

The renderer receives `jobId`, `asset`, `campaign`, `platformPackages`, `mediaDirection`, and `videoProductionManifest`.

It must return JSON containing an HTTPS `mediaUrl`. Optional fields may include `renderId`, `durationSeconds`, and `thumbnailUrl`.

The orchestrator fails closed if the renderer does not return a valid HTTPS media URL.

## Important scope

V22 prepares and validates the complete production manifest; the external renderer remains responsible for actual video synthesis, voice generation, caption burn-in, audio mixing and MP4 assembly. No renderer capability is assumed beyond its webhook contract.

`AUTOPILOT_ENABLED=false` remains the safe default until production integrations are configured and tested.
