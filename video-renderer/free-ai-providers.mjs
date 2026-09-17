const defaults = {
  image: ['Z-Image Turbo', 'FREE_IMAGE_SPACE_URL', 'https://mrfakename-z-image-turbo.hf.space', true],
  video: ['Wan 2.2 14B Fast', 'FREE_VIDEO_SPACE_URL', 'https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space', false],
  voice: ['Kokoro TTS', 'FREE_VOICE_SPACE_URL', 'https://innersignal-kokoro-tts.hf.space', true],
  music: ['Stable Audio Open Zero', 'FREE_MUSIC_SPACE_URL', 'https://artificialguybr-stable-audio-open-zero.hf.space', true],
}

export function getFreeProviders() {
  return Object.fromEntries(Object.entries(defaults).map(([kind, [name, env, fallback, required]]) => [kind, {
    name,
    required,
    source: 'Hugging Face Zero',
    baseUrl: (process.env[env] || fallback).replace(/\/$/, ''),
  }]))
}

async function fetchWithTimeout(url, asJson = false) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal })
    let body = null
    if (asJson && response.ok) body = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, body }
  } finally {
    clearTimeout(timer)
  }
}

function endpointSummary(info) {
  const named = info?.named_endpoints || {}
  return Object.entries(named).slice(0, 12).map(([name, spec]) => ({
    name,
    parameters: Array.isArray(spec?.parameters)
      ? spec.parameters.map((p) => p?.parameter_name || p?.label || p?.component || '?').slice(0, 12)
      : [],
  }))
}

export async function probeProvider(provider) {
  const startedAt = Date.now()
  const infoUrl = `${provider.baseUrl}/gradio_api/info`
  let error = ''
  try {
    const info = await fetchWithTimeout(infoUrl, true)
    if (info.ok) {
      return {
        ok: true,
        name: provider.name,
        url: infoUrl,
        status: info.status,
        latencyMs: Date.now() - startedAt,
        endpoints: endpointSummary(info.body),
      }
    }
    error = `HTTP ${info.status}`
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  for (const url of [`${provider.baseUrl}/config`, provider.baseUrl]) {
    try {
      const result = await fetchWithTimeout(url)
      if (result.ok) return { ok: true, name: provider.name, url, status: result.status, latencyMs: Date.now() - startedAt, endpoints: [] }
      error = `HTTP ${result.status}`
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  return { ok: false, name: provider.name, error, latencyMs: Date.now() - startedAt, endpoints: [] }
}

export async function probeFreeProviders() {
  const providers = getFreeProviders()
  const pairs = await Promise.all(Object.entries(providers).map(async ([kind, provider]) => [kind, await probeProvider(provider)]))
  const results = Object.fromEntries(pairs)
  const requiredKinds = Object.entries(providers).filter(([, p]) => p.required).map(([kind]) => kind)
  return {
    ok: requiredKinds.every((kind) => results[kind]?.ok),
    mode: 'zero-paid-credit',
    requiredKinds,
    results,
  }
}
