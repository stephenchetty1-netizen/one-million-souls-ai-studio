# V24 — AI Creative Asset Generator

V24 adds an optional production asset layer to the autonomous pipeline.

## Flow

BIBLE/QUALITY → VIDEO PLAN → AI VISUALS → AI NARRATION → RENDERER → QUALITY → PUBLISH

## Providers

- Images: OpenAI GPT-Image-2
- Speech: OpenAI GPT-4o mini TTS
- Final assembly: configured external renderer

## Safety and rights

The system does not generate fake Scripture inside images, copyrighted lyrics, unlicensed music, or unauthorized real-person voice impersonations. The renderer must still enforce its own media-rights checks.

## Enablement

`CREATIVE_ASSETS_ENABLED=false` is the default. Set it to `true` only after the OpenAI account, storage/request-size limits, renderer contract, and production costs have been tested.

Generated assets are returned as base64 payloads for the renderer contract. For production at scale, replace this transport with object storage and signed HTTPS URLs to avoid oversized webhook requests.
