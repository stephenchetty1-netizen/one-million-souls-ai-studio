# V23 — AI Voice & Visual Asset Engine

V23 extends V22 with an explicit asset/voice manifest between video planning and rendering.

## Flow

SCRIPT → QUALITY → MEDIA DIRECTION → VIDEO PLAN → ASSET/VOICE MANIFEST → RENDERER → MP4 → PUBLISH

## Renderer contract

The configured `VIDEO_RENDER_WEBHOOK_URL` receives `assetVoiceManifest`, `productionPlan`, campaign data and platform packages. It must return JSON containing an HTTPS `mediaUrl` before publication can proceed.

V23 does not fabricate a voice file or claim a local voice provider. Voice generation and final assembly remain the responsibility of the configured renderer/provider.

## Guardrails

- Owned/licensed/public-domain/platform-cleared assets only.
- No unauthorized real-person voice impersonation.
- No copyrighted lyrics or unlicensed music.
- Preserve verified Scripture and approved narration.
- Fail closed if the renderer does not return an HTTPS media URL.
