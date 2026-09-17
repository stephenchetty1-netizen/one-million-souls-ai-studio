import { getFreeProviders } from './free-ai-providers.mjs'
import { callGradio, collectAssetUrls, uploadRemoteFileToGradio } from './free-ai-gradio.mjs'

const enabled = process.env.FREE_AI_SMOKE_ENABLED === 'true'

async function run() {
  const providers = getFreeProviders()
  const report = { mode: 'zero-paid-credit', image: null, voice: null, music: null, video: null }

  try {
    const output = await callGradio(providers.image.baseUrl, '/infer', [
      'cinematic Christian encouragement scene, sunrise over mountains, open Bible in foreground, hopeful warm natural light, realistic photography, vertical social media composition, no text',
      42,
      true,
      576,
      1024,
      4,
    ], 240000)
    const urls = collectAssetUrls(output)
    report.image = { ok: urls.length > 0, urls: urls.slice(0, 3) }
  } catch (error) {
    report.image = { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  try {
    const output = await callGradio(providers.voice.baseUrl, '/generate_first', [
      'Fear may be loud, but God is with you. Choose faith today, keep praying, and keep your eyes on Jesus.',
      'bm_george',
      0.95,
      true,
    ], 180000)
    const urls = collectAssetUrls(output)
    report.voice = { ok: urls.length > 0, urls: urls.slice(0, 3) }
  } catch (error) {
    report.voice = { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  try {
    const output = await callGradio(providers.music.baseUrl, '/predict_batched', [
      'gentle cinematic inspirational ambient instrumental, warm piano and soft pads, hopeful Christian encouragement background, no vocals',
      null,
    ], 300000)
    const urls = collectAssetUrls(output)
    report.music = { ok: urls.length > 0, urls: urls.slice(0, 4) }
  } catch (error) {
    report.music = { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  if (report.image?.ok && report.image.urls?.[0]) {
    try {
      const image = await uploadRemoteFileToGradio(providers.video.baseUrl, report.image.urls[0], 'faith-over-fear.png')
      const output = await callGradio(providers.video.baseUrl, '/generate_video', [
        image,
        'slow cinematic camera push forward, subtle natural movement in clouds and light rays, peaceful inspirational mood, realistic, preserve the Bible and mountain scene',
        4,
        'distorted text, warped objects, flicker, low quality, extra objects',
        5,
        3.5,
        3.5,
        42,
        true,
      ], 420000)
      const urls = collectAssetUrls(output)
      report.video = { ok: urls.length > 0, urls: urls.slice(0, 3) }
    } catch (error) {
      report.video = { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  } else {
    report.video = { ok: false, error: 'Skipped because image generation did not return a usable URL' }
  }

  report.ok = ['image', 'voice', 'music', 'video'].every((kind) => report[kind]?.ok)
  console.log('FREE_AI_SMOKE_RESULT', JSON.stringify(report))
}

if (enabled) {
  setTimeout(() => run().catch((error) => console.error('FREE_AI_SMOKE_FATAL', error instanceof Error ? error.message : String(error))), 5000)
}
