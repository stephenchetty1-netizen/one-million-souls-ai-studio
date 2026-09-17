import { getFreeProviders } from './free-ai-providers.mjs'
import { callGradio, collectAssetUrls, uploadRemoteFileToGradio } from './free-ai-gradio.mjs'

const enabled = process.env.FREE_AI_SMOKE_ENABLED === 'true'
const requestedStages = new Set(
  (process.env.FREE_AI_SMOKE_STAGES || 'image,voice,music,video')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
)

function wants(kind) {
  return requestedStages.has(kind) || (kind === 'image' && requestedStages.has('video'))
}

function logStage(kind, value) {
  console.log('FREE_AI_SMOKE_STAGE', JSON.stringify({ kind, ...value }))
}

async function generateImage(providers) {
  console.log('FREE_AI_SMOKE_START_IMAGE')
  try {
    const output = await callGradio(providers.image.baseUrl, '/infer', [
      'cinematic Christian encouragement scene, sunrise over mountains, open Bible in foreground, hopeful warm natural light, realistic photography, vertical social media composition, no text',
      42, true, 576, 1024, 4,
    ], 240000)
    const urls = collectAssetUrls(output)
    const result = { ok: urls.length > 0, urls: urls.slice(0, 3) }
    logStage('image', result)
    return result
  } catch (error) {
    const result = { ok: false, error: error instanceof Error ? error.message : String(error) }
    logStage('image', result)
    return result
  }
}

async function generateVoice(providers) {
  console.log('FREE_AI_SMOKE_START_VOICE')
  try {
    const output = await callGradio(providers.voice.baseUrl, '/generate_first', [
      'Fear may be loud, but God is with you. Choose faith today, keep praying, and keep your eyes on Jesus.',
      'bm_george', 0.95, true,
    ], 180000)
    const urls = collectAssetUrls(output)
    const result = { ok: urls.length > 0, urls: urls.slice(0, 3) }
    logStage('voice', result)
    return result
  } catch (error) {
    const result = { ok: false, error: error instanceof Error ? error.message : String(error) }
    logStage('voice', result)
    return result
  }
}

async function generateMusic(providers) {
  console.log('FREE_AI_SMOKE_START_MUSIC')
  try {
    const output = await callGradio(providers.music.baseUrl, '/generate_audio', [
      'gentle cinematic inspirational ambient instrumental, warm piano and soft pads, hopeful background music for Christian encouragement, no vocals',
      10,
      1.5,
      5,
    ], 300000)
    const urls = collectAssetUrls(output)
    const result = { ok: urls.length > 0, urls: urls.slice(0, 4), rawType: typeof output }
    logStage('music', result)
    return result
  } catch (error) {
    const result = { ok: false, error: error instanceof Error ? error.message : String(error) }
    logStage('music', result)
    return result
  }
}

async function generateVideo(providers, imageResult) {
  console.log('FREE_AI_SMOKE_START_VIDEO')
  if (!imageResult?.ok || !imageResult.urls?.[0]) {
    const result = { ok: false, error: 'Skipped because image generation did not return a usable URL' }
    logStage('video', result)
    return result
  }
  try {
    const image = await uploadRemoteFileToGradio(providers.video.baseUrl, imageResult.urls[0], 'faith-over-fear.png')
    const output = await callGradio(providers.video.baseUrl, '/generate_video', [
      image,
      'slow cinematic camera push forward, subtle natural movement in clouds and light rays, peaceful inspirational mood, realistic, preserve the Bible and mountain scene',
      4,
      'distorted text, warped objects, flicker, low quality, extra objects',
      5, 3.5, 3.5, 42, true,
    ], 420000)
    const urls = collectAssetUrls(output)
    const result = { ok: urls.length > 0, urls: urls.slice(0, 3) }
    logStage('video', result)
    return result
  } catch (error) {
    const result = { ok: false, error: error instanceof Error ? error.message : String(error) }
    logStage('video', result)
    return result
  }
}

async function run() {
  console.log('FREE_AI_SMOKE_START', JSON.stringify({ stages: [...requestedStages] }))
  const providers = getFreeProviders()
  const report = { mode: 'zero-paid-credit', stages: [...requestedStages] }

  let image = null
  if (wants('image')) {
    image = await generateImage(providers)
    if (requestedStages.has('image')) report.image = image
  }
  if (wants('voice')) report.voice = await generateVoice(providers)
  if (wants('music')) report.music = await generateMusic(providers)
  if (wants('video')) report.video = await generateVideo(providers, image)

  const requested = [...requestedStages]
  report.ok = requested.every((kind) => report[kind]?.ok)
  console.log('FREE_AI_SMOKE_RESULT', JSON.stringify(report))
}

if (enabled) {
  console.log('FREE_AI_SMOKE_ENABLED', JSON.stringify({ stages: [...requestedStages] }))
  setTimeout(() => run().catch((error) => console.error('FREE_AI_SMOKE_FATAL', error instanceof Error ? error.message : String(error))), 5000)
}
