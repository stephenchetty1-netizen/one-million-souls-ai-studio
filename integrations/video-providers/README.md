# OMS optional video-provider adapters (not live-connected)

This directory is intentionally outside the existing Railway watch patterns. It does NOT change the V59 production app, auto-post, create paid jobs, or claim a GPU host exists.

## Existing connections as inspected on 23 September 2026
- Higgsfield is authenticated in ChatGPT, but its ChatGPT connection cannot be silently transferred to a Railway application.
- GitHub repository: stephenchetty1-netizen/one-million-souls-ai-studio.
- Railway project: lavish-enjoyment, services one-million-souls-v59 and one-million-souls-video-renderer.
- No HF_API_KEY_ID, HF_API_KEY_SECRET or COMFYUI_URL variable names were present on those inspected services.

## Live setup prerequisites
1. Choose a suitable secured GPU host to run ComfyUI with a licensed compatible LTX workflow and model files. For full LTX-2.5 the official starting recommendation is NVIDIA/CUDA 32GB+ VRAM and 100GB+ storage. A mobile browser is only the controller.
2. Install ComfyUI and use its official LTX-2.5 text-to-video template; test a render manually and export the working **API-format** workflow JSON. Do not mix incompatible versions.
3. Set Railway secret COMFYUI_URL to an authenticated HTTPS endpoint, optionally COMFYUI_API_TOKEN for the host's actual bearer-token scheme. Do not expose ComfyUI publicly without access control. Token/header schemes may differ by GPU hosting provider.
4. Only if willing to fund separate pay-per-use Higgsfield API billing: create credentials at https://cloud.higgsfield.ai and set server-side HF_API_KEY_ID and HF_API_KEY_SECRET on the target Railway service. They are **not** the ChatGPT Higgsfield connection or the user's Higgsfield website credits.
5. Keep ZERO_CREDIT_ONLY=true and paidGenerationApproved=false until explicit paid-generation authorization. Do not add keys to GitHub.
6. Wire these optional adapters into the existing server-side generation pipeline with durable job state and approval/rights gates, then deploy and test output delivery to the existing storage bucket. Current adapter functions alone are not that integration.

Exports: connectionStatus, submitHiggsfieldVideo, higgsfieldRequestStatus, submitComfyWorkflow, comfyWorkflowStatus.

Higgsfield request format: https://open.higgsfield.ai/quick-start
LTX-ComfyUI installation/workflows: https://docs.ltx.io/open-source-model/integration-tools/comfy-ui
