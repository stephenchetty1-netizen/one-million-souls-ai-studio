const defaults = {
  image: ['FLUX.1 Schnell', 'FREE_IMAGE_SPACE_URL', 'https://black-forest-labs-flux-1-schnell.hf.space', true],
  video: ['Wan 2.2 14B Fast', 'FREE_VIDEO_SPACE_URL', 'https://zerogpu-aoti-wan2-2-14b-fast.hf.space', false],
  voice: ['Kokoro TTS', 'FREE_VOICE_SPACE_URL', 'https://innersignal-kokoro-tts.hf.space', true],
  music: ['MusicGen', 'FREE_MUSIC_SPACE_URL', 'https://facebook-musicgen.hf.space', true],
}

export function getFreeProviders() {
  return Object.fromEntries(Object.entries(defaults).map(([kind, [name, env, fallback, required]]) => [kind, {
    name,
    required,
    source: 'Hugging Face Zero',
    baseUrl: (process.env[env] || fallback).replace(/\/$/, ''),
  }]))
}

async function tryUrl(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal })
    return { ok: response.ok, status: response.status }
  } finally {
    clearTimeout(timer)
  }
}

export async function probeProvider(provider) {
  const startedAt = Date.now()
  let error = ''
  for (const url of [`${provider.baseUrl}/gradio_api/info`, `${provider.baseUrl}/config`, provider.baseUrl]) {
    try {
      const result = await tryUrl(url)
      if (result.ok) return { ok: true, name: provider.name, url, status: result.status, latencyMs: Date.now() - startedAt }
      error = `HTTP ${result.status}`
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }
  return { ok: false, name: provider.name, error, latencyMs: Date.now() - startedAt }
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
