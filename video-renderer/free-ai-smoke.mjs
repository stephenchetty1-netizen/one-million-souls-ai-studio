import { getFreeProviders } from './free-ai-providers.mjs'
import { callGradio, collectAssetUrls, uploadRemoteFileToGradio } from './free-ai-gradio.mjs'

const enabled = process.env.FREE_AI_SMOKE_ENABLED === 'true'

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
    // MusicGen's public Zero Space exposes a batched Gradio function whose Python
    // implementation expects lists for both texts and melodies.
    const output = await callGradio(providers.music.baseUrl, '/predict_batched', [
      ['gentle cinematic inspirational ambient instrumental, warm piano and soft pads, hopeful Christian encouragement background, no vocals'],
      [null],
    ], 300000)
    const urls = collectAssetUrls(output)
    const result = { ok: urls.length > 0, urls: urls.slice(0, 4) }
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
  console.log('FREE_AI_SMOKE_START')
  const providers = getFreeProviders()
  const [image, voice, music] = await Promise.all([
    generateImage(providers),
    generateVoice(providers),
    generateMusic(providers),
  ])
  const video = await generateVideo(providers, image)
  const report = { mode: 'zero-paid-credit', image, voice, music, video }
  report.ok = ['image', 'voice', 'music', 'video'].every((kind) => report[kind]?.ok)
  console.log('FREE_AI_SMOKE_RESULT', JSON.stringify(report))
}

if (enabled) {
  console.log('FREE_AI_SMOKE_ENABLED')
  setTimeout(() => run().catch((error) => console.error('FREE_AI_SMOKE_FATAL', error instanceof Error ? error.message : String(error))), 5000)
}
