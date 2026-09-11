# V25 — Autonomous Video Assembly & Final Quality Director

V25 converts the V24 creative asset bundle into an explicit assembly manifest and places a final quality gate between the renderer and publishing.

## Flow

`APPROVED CAMPAIGN → VIDEO PLAN → CREATIVE ASSETS → ASSEMBLY MANIFEST → RENDERER → FINAL QUALITY GATE → PUBLISH`

## Assembly contract

The renderer receives:
- `videoAssemblyManifest`
- approved campaign/content factory asset
- media direction
- video production manifest
- generated visual/voice assets
- platform packages

The assembly specification requires 1080×1920, 30fps, MP4, burned-in captions, voice-first audio, and a maximum duration of 60 seconds.

## Final quality gate

Before publishing, the renderer response must satisfy:
- valid HTTPS `mediaUrl`
- MP4 media when MIME type is provided
- valid duration
- Scripture integrity flag
- rights-cleared flag
- captions present
- audio present
- 1080×1920 output

If any check fails, the orchestrator stops and does not publish.

## Renderer responsibility

V25 still uses the configured external renderer for actual MP4 assembly. The renderer must return the quality metadata flags used by the final gate. No successful render is assumed merely because an HTTP request succeeds.

`AUTOPILOT_ENABLED=false` remains the safe default.
