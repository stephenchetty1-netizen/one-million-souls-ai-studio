import { promises as fs } from 'node:fs'
import path from 'node:path'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function apiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim()
}

export function googleVeoEnabled() {
  if (process.env.GOOGLE_VEO_ENABLED === 'false') return false
  return Boolean(apiKey())
}

function envChoice(name, allowed, fallback) {
  const value = String(process.env[name] || fallback).trim()
  return allowed.includes(value) ? value : fallback
}

function durationFor(resolution, requestedSeconds) {
  if (resolution === '1080p' || resolution === '4k') return '8'
  const requested = Math.round(Number(requestedSeconds || 6))
  if (requested <= 4) return '4'
  if (requested <= 6) return '6'
  return '8'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' })
    const text = await response.text()
    let payload
    try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.message || text || `HTTP ${response.status}`
      throw new Error(`Google Veo request failed (${response.status}): ${detail}`)
    }
    return payload
  } finally {
    clearTimeout(timer)
  }
}

function extractVideoUri(operation) {
  return operation?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
    || operation?.response?.generatedVideos?.[0]?.video?.uri
    || operation?.response?.generated_videos?.[0]?.video?.uri
    || ''
}

export async function createGoogleVeoScene(prompt, index, work, requestedSeconds) {
  const key = apiKey()
  if (!key) throw new Error('Google Veo is not configured: GEMINI_API_KEY or GOOGLE_AI_API_KEY is required')

  const model = String(process.env.GOOGLE_VEO_MODEL || 'veo-3.1-generate-preview').trim()
  const resolution = envChoice('GOOGLE_VEO_RESOLUTION', ['720p','1080p','4k'], '1080p')
  const aspectRatio = envChoice('GOOGLE_VEO_ASPECT_RATIO', ['9:16','16:9'], '9:16')
  const durationSeconds = durationFor(resolution, requestedSeconds)
  const timeoutMs = Math.max(120000, Number(process.env.GOOGLE_VEO_TIMEOUT_MS || 900000))
  const pollMs = Math.max(5000, Number(process.env.GOOGLE_VEO_POLL_MS || 10000))
  const seedBase = Math.max(0, Number(process.env.GOOGLE_VEO_SEED || 0))
  const seed = seedBase ? seedBase + index : undefined

  const productionPrompt = [
    prompt,
    'Create continuous premium cinematic motion, stable composition, natural physics, realistic faces and hands, clean lighting, no visible text, no captions, no typography, no logos, no watermark.',
  ].join(' ')

  const parameters = {
    aspectRatio,
    resolution,
    durationSeconds,
    numberOfVideos: 1,
  }
  if (seed !== undefined) parameters.seed = seed

  const start = await fetchJson(
    `${API_BASE}/models/${encodeURIComponent(model)}:predictLongRunning`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        instances: [{ prompt: productionPrompt }],
        parameters,
      }),
    },
    60000,
  )

  if (!start?.name) throw new Error('Google Veo did not return an operation name')

  const deadline = Date.now() + timeoutMs
  let operation = start
  while (!operation?.done) {
    if (Date.now() >= deadline) throw new Error(`Google Veo timed out after ${timeoutMs}ms`)
    await sleep(pollMs)
    operation = await fetchJson(
      `${API_BASE}/${String(start.name).replace(/^\//, '')}`,
      { headers: { 'x-goog-api-key': key } },
      60000,
    )
  }

  if (operation?.error) {
    throw new Error(`Google Veo generation failed: ${operation.error.message || JSON.stringify(operation.error)}`)
  }

  const uri = extractVideoUri(operation)
  if (!uri) throw new Error('Google Veo completed without a downloadable video URI')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 180000)
  try {
    const response = await fetch(uri, {
      headers: { 'x-goog-api-key': key },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!response.ok) throw new Error(`Google Veo download failed (${response.status})`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length < 10000) throw new Error('Google Veo returned an invalid video payload')
    const local = path.join(work, `google-veo-scene-${index + 1}.mp4`)
    await fs.writeFile(local, bytes)
    return {
      local,
      videoUrl: uri,
      source: 'google-veo-video',
      provider: 'Google Veo 3.1 (Flow-class)',
      model,
      resolution,
      aspectRatio,
      generatedDurationSeconds: Number(durationSeconds),
    }
  } finally {
    clearTimeout(timer)
  }
}
