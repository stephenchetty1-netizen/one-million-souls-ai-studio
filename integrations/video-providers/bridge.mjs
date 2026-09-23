// OMS optional provider adapters. Server-side only; not connected to V59 until explicitly wired.
const jsonHeaders = { "Content-Type": "application/json" };
function requireHiggsfield(env) {
  if (!env.HF_API_KEY_ID || !env.HF_API_KEY_SECRET) throw new Error("Higgsfield API keys not configured");
  return { ...jsonHeaders, Authorization: `Key ${env.HF_API_KEY_ID}:${env.HF_API_KEY_SECRET}` };
}
function comfyBase(env) {
  if (!env.COMFYUI_URL) throw new Error("COMFYUI_URL not configured");
  const url = new URL(env.COMFYUI_URL);
  const local = ["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error("Remote ComfyUI must use HTTPS");
  }
  return url.href.endsWith("/") ? url.href.slice(0, -1) : url.href;
}
export function connectionStatus(env = process.env) {
  const comfy = Boolean(env.COMFYUI_URL);
  return {
    higgsfieldChatGPT: "managed by ChatGPT, not shared with Railway",
    higgsfieldAPI: Boolean(env.HF_API_KEY_ID && env.HF_API_KEY_SECRET),
    comfyUIEndpoint: comfy,
    ltxWorkflow: comfy && Boolean(env.LTX_WORKFLOW_CONFIGURED === "true"),
    ffmpeg: "handled by existing OMS video-renderer; verify separately",
    liveV59Integration: false,
  };
}
export async function submitHiggsfieldVideo(prompt, {
  env = process.env, fetchImpl = fetch, paidGenerationApproved = false,
} = {}) {
  if (env.ZERO_CREDIT_ONLY === "true" || !paidGenerationApproved) {
    throw new Error("Paid Higgsfield API generation is disabled until expressly approved");
  }
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("Prompt required");
  const response = await fetchImpl("https://api.higgsfield.ai/bytedance/seedance-2.0/text-to-video", {
    method: "POST",
    headers: requireHiggsfield(env),
    body: JSON.stringify({ prompt: prompt.trim(), duration: 5, resolution: "720p",
      aspect_ratio: "9:16", generate_audio: false }),
  });
  if (!response.ok) throw new Error(`Higgsfield request failed: HTTP ${response.status}`);
  return response.json();
}
export async function higgsfieldRequestStatus(requestId, { env = process.env, fetchImpl = fetch } = {}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(requestId || "")) throw new Error("Invalid request ID");
  const response = await fetchImpl(`https://api.higgsfield.ai/requests/${requestId}/status`, {
    headers: requireHiggsfield(env),
  });
  if (!response.ok) throw new Error(`Higgsfield status failed: HTTP ${response.status}`);
  return response.json();
}
function comfyHeaders(env) {
  return { ...jsonHeaders, ...(env.COMFYUI_API_TOKEN ? {
    Authorization: `Bearer ${env.COMFYUI_API_TOKEN}`,
  } : {}) };
}
export async function submitComfyWorkflow(workflow, { env = process.env, fetchImpl = fetch } = {}) {
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error("Export an actual ComfyUI API-format workflow first");
  }
  const url = comfyBase(env);
  const response = await fetchImpl(`${url}/prompt`, {
    method: "POST", headers: comfyHeaders(env), body: JSON.stringify({ prompt: workflow }),
  });
  if (!response.ok) throw new Error(`ComfyUI queue failed: HTTP ${response.status}`);
  const result = await response.json();
  if (!result.prompt_id) throw new Error("ComfyUI did not return a prompt_id");
  return result;
}
export async function comfyWorkflowStatus(promptId, { env = process.env, fetchImpl = fetch } = {}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(promptId || "")) throw new Error("Invalid prompt ID");
  const response = await fetchImpl(`${comfyBase(env)}/history/${promptId}`, {
    headers: comfyHeaders(env),
  });
  if (!response.ok) throw new Error(`ComfyUI history failed: HTTP ${response.status}`);
  return response.json();
}
