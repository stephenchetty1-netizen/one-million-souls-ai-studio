import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getFreeProviders } from './free-ai-providers.mjs'
import { callGradio, collectAssetUrls, uploadRemoteFileToGradio } from './free-ai-gradio.mjs'
import { createLocalFallbackScene, createLocalAmbientMusic, animateStillImage } from './local-media-fallback.mjs'

const execFileAsync = promisify(execFile)
const WIDTH = Number(process.env.RENDER_WIDTH || 1080)
const HEIGHT = Number(process.env.RENDER_HEIGHT || 1920)
const FPS = Number(process.env.RENDER_FPS || 30)

const storageReady = Boolean(
  process.env.ENDPOINT && process.env.BUCKET && process.env.REGION &&
  process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY
)

const s3 = storageReady ? new S3Client({
  endpoint: process.env.ENDPOINT,
  region: process.env.REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
}) : null

function publicBase() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  return ''
}

function cleanText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function extractTitle(body) {
  return cleanText(body?.title || body?.campaign?.title || body?.topic, 'ONE MILLION SOULS').slice(0, 100)
}

function extractScript(body) {
  return cleanText(
    body?.script || body?.campaign?.script || body?.campaign?.content || body?.campaign?.message,
    'Jesus is faithful. Keep trusting God, keep praying, and keep moving forward in faith.'
  ).slice(0, 2400)
}

function assTime(seconds) {
  const cs = Math.max(0, Math.round(seconds * 100))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}

function cleanAssText(text) {
  return text.replace(/[{}]/g, '').replace(/\\s+/g, ' ').trim()
}

function highlightCaption(text) {
  const clean = cleanAssText(text)
  const gold = '&H0053C4F6&'
  return clean.replace(/\\b(God|Jesus|Lord|Christ|faith|pray|praying|believe|believing|hope|grace|fear)\\b/gi,
    (word) => `{\\\\c${gold}\\\\b1}${word}{\\\\rCaption}`)
}

function buildAss(script, duration) {
  const words = script.replace(/\\s+/g, ' ').trim().split(' ').filter(Boolean)
  const chunks = []
  for (let i = 0; i < words.length; i += 5) chunks.push(words.slice(i, i + 5).join(' '))
  if (!chunks.length) chunks.push('Keep trusting God')
  const slice = duration / Math.max(1, chunks.length)

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    'Style: Caption,Lato,58,&H00FFFFFF,&H00FFFFFF,&H00000000,&H98000000,-1,0,0,0,100,100,0,0,3,1,0,2,90,90,170,1',
    '',
    '[Events]',
    'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
  ]

  const events = chunks.map((text, index) => {
    const start = index * slice
    const end = Math.min(duration, (index + 1) * slice)
    return `Dialogue: 0,${assTime(start)},${assTime(Math.max(start + 0.9, end))},Caption,,0,0,0,,${highlightCaption(text)}`
  })

  return [...header, ...events, ''].join('\\n')
}

function wrapTitle(title) {
  const words = title.toUpperCase().replace(/\\s+/g, ' ').trim().split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > 18 && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 2).join('\\n')
}

async function download(url, target, timeoutMs = 120000) {async function download(url, target, timeoutMs = 120000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!response.ok) throw new Error(`Download failed ${response.status} ${url}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    await fs.writeFile(target, bytes)
    return target
  } finally {
    clearTimeout(timer)
  }
}

async function mediaDuration(file) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { timeout: 30000 })
  const parsed = Number.parseFloat(stdout.trim())
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid media duration for ${file}`)
  return parsed
}

function scenePrompts(body, title, script) {
  const supplied = Array.isArray(body?.visualPrompts)
    ? body.visualPrompts.filter((x) => typeof x === 'string' && x.trim())
    : []
  if (supplied.length >= 3) return supplied.slice(0, 4)

  const story = `${title}. ${script.slice(0, 320)}`
  const common = 'cinematic photorealistic film still, premium commercial photography, natural skin and hands, realistic lighting, high dynamic range, vertical 9:16, no words, no captions, no typography, no watermark, no logos'

  return [
    `${common}, emotional opening scene about overcoming fear, solitary person near a rain-streaked window at blue hour, distant warm light breaking through storm clouds, intimate realistic atmosphere, ${story}`,
    `${common}, close-up of natural hands in prayer beside an open Bible on a wooden table, warm sunrise through a window, shallow depth of field, peaceful reverent atmosphere, ${story}`,
    `${common}, hopeful person walking along a quiet path toward a brilliant sunrise, subtle cross-shaped light in distant clouds, wide cinematic composition, fresh morning mist, ${story}`,
    `${common}, uplifting worship moment seen from behind with a small diverse group in soft golden light, hands raised naturally, hopeful sky, authentic documentary feeling, ${story}`,
  ]
}

async function generateCloudScene(providers, prompt, index, work, seconds) {
  const imageOutput = await callGradio(providers.image.baseUrl, '/generate_image', [
    prompt, 1024, 576, 7, 100 + index, true,
  ], 240000)

  const imageUrl = collectAssetUrls(imageOutput)[0]
  if (!imageUrl) throw new Error(`Scene ${index + 1}: image provider returned no asset`)

  const still = path.join(work, `ai-still-${index + 1}.png`)
  await download(imageUrl, still, 120000)

  if (process.env.FREE_VIDEO_MOTION_ENABLED === 'false') {
    const localMotion = await animateStillImage(still, index, work, seconds, 'cloud-image-local-motion')
    return { ...localMotion, imageUrl }
  }

  try {
    const image = await uploadRemoteFileToGradio(providers.video.baseUrl, imageUrl, `scene-${index + 1}.png`)
    const videoOutput = await callGradio(providers.video.baseUrl, '/generate_video', [
      image,
      'slow premium cinematic camera movement, subtle natural subject movement, realistic clouds and light, gentle parallax, stable composition, preserve identity and scene structure',
      4,
      'text, watermark, warped face, distorted hands, extra fingers, duplicated objects, flicker, jitter, camera shake, low quality',
      Math.max(3, Math.min(5, Math.round(seconds))), 3.5, 3.5, 200 + index, true,
    ], 480000)

    const videoUrl = collectAssetUrls(videoOutput)[0]
    if (!videoUrl) throw new Error('video provider returned no asset')
    const local = path.join(work, `scene-${index + 1}.mp4`)
    await download(videoUrl, local, 120000)
    return { imageUrl, videoUrl, local, source: 'cloud-ai-video' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('FREE_AI_VIDEO_MOTION_FALLBACK', JSON.stringify({ index, error: message }))
    const localMotion = await animateStillImage(still, index, work, seconds, 'cloud-image-local-motion')
    return { ...localMotion, imageUrl }
  }
}

async function generateScene(providers, prompt, index, work, seconds) {
  const allowProcedural = process.env.ALLOW_PROCEDURAL_FALLBACK === 'true'

  if (process.env.LOCAL_VISUALS_ONLY === 'true') {
    if (!allowProcedural) throw new Error('Quality gate blocked: procedural visuals are test-only')
    return createLocalFallbackScene(index, work, seconds)
  }

  try {
    return await generateCloudScene(providers, prompt, index, work, seconds)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!allowProcedural) {
      throw new Error(`Quality gate blocked scene ${index + 1}: AI image unavailable (${message})`)
    }
    console.warn('FREE_AI_PROCEDURAL_TEST_FALLBACK', JSON.stringify({ index, error: message }))
    return createLocalFallbackScene(index, work, seconds)
  }
}

async function generateEdgeVoice(script, work) {async function generateEdgeVoice(script, work) {
  const local = path.join(work, 'voice.mp3')
  const cli = path.join(process.cwd(), 'node_modules', '.bin', 'node-edge-tts')
  const voiceName = process.env.EDGE_TTS_VOICE || 'en-ZA-LeahNeural'
  const lang = process.env.EDGE_TTS_LANG || 'en-ZA'
  const rate = process.env.EDGE_TTS_RATE || '-4%'
  const timeout = process.env.EDGE_TTS_TIMEOUT || '30000'

  await execFileAsync(cli, [
    '-t', script,
    '-f', local,
    '-v', voiceName,
    '-l', lang,
    `--rate=${rate}`,
    '--timeout', timeout,
  ], { timeout: Number(timeout) + 15000, maxBuffer: 5 * 1024 * 1024 })

  const stat = await fs.stat(local)
  if (stat.size < 2000) throw new Error('Edge neural TTS produced an invalid audio file')
  return { url: null, local, provider: `Edge neural TTS (${voiceName})` }
}

async function generateCloudVoice(providers, script, work) {
  const output = await callGradio(providers.voice.baseUrl, '/generate_all', [
    script,
    process.env.FREE_TTS_VOICE || 'bm_george',
    Number(process.env.FREE_TTS_SPEED || 0.95),
    true,
  ], 240000)
  const url = collectAssetUrls(output)[0]
  if (!url) throw new Error('Cloud voice provider returned no audio asset')
  const local = path.join(work, 'voice.wav')
  await download(url, local, 120000)
  const stat = await fs.stat(local)
  if (stat.size < 2000) throw new Error('Cloud voice provider returned invalid audio')
  return { url, local, provider: providers.voice.name }
}

async function generateVoice(providers, script, work) {
  if (process.env.EDGE_TTS_ENABLED !== 'false') {
    try {
      return await generateEdgeVoice(script, work)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('EDGE_TTS_FALLBACK', JSON.stringify({ error: message }))
    }
  }
  return generateCloudVoice(providers, script, work)
}

async function generateCloudMusic(providers, duration, work) {
  const seconds = Math.max(10, Math.min(30, Math.ceil(duration)))
  const output = await callGradio(providers.music.baseUrl, '/generate_audio', [
    'gentle cinematic inspirational ambient instrumental, warm piano, soft pads, subtle strings, hopeful Christian encouragement background, no vocals, no drums dominating',
    seconds,
    1.5,
    7,
  ], 360000)
  const url = collectAssetUrls(output)[0]
  if (!url) throw new Error('Music provider returned no audio stream')
  const local = path.join(work, 'music.m4a')
  await execFileAsync('ffmpeg', ['-y', '-i', url, '-t', String(seconds), '-c:a', 'aac', '-b:a', '128k', local], {
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024,
  })
  return { url, local, provider: providers.music.name }
}

async function generateMusic(providers, duration, work) {
  if (process.env.LOCAL_MUSIC_ONLY === 'true') return createLocalAmbientMusic(duration, work)
  try {
    return await generateCloudMusic(providers, duration, work)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('FREE_AI_MUSIC_FALLBACK', JSON.stringify({ error: message }))
    return createLocalAmbientMusic(duration, work)
  }
}

async function compose({ scenes, voice, music, script, title, work }) {
  const voiceDuration = await mediaDuration(voice.local)
  const captions = path.join(work, 'captions.ass')
  const titlePath = path.join(work, 'title.txt')
  const concatPath = path.join(work, 'concat.txt')
  const visualPath = path.join(work, 'visuals.mp4')
  const out = path.join(work, 'master.mp4')
  const streamCopySafe = scenes.every((scene) =>
    scene.source === 'local-procedural-cinematic' || scene.source === 'cloud-image-local-motion'
  )

  await fs.writeFile(captions, buildAss(script, voiceDuration), 'utf8')
  await fs.writeFile(titlePath, wrapTitle(title), 'utf8')
  await fs.writeFile(concatPath, scenes.map((scene) => `file '${scene.local.replaceAll("'", "'\\\\''")}'`).join('\\n'), 'utf8')

  if (streamCopySafe) {
    await execFileAsync('ffmpeg', [
      '-y', '-fflags', '+genpts', '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-an', '-c:v', 'copy', '-movflags', '+faststart', visualPath,
    ], { timeout: 60000, maxBuffer: 5 * 1024 * 1024 })
  } else {
    await execFileAsync('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-filter_threads', '1',
      '-vf', `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},fps=${FPS}`,
      '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-threads', '2', '-pix_fmt', 'yuv420p', visualPath,
    ], { timeout: 300000, maxBuffer: 8 * 1024 * 1024 })
  }

  const titleFont = '/usr/share/fonts/truetype/lato/Lato-Black.ttf'
  const labelFont = '/usr/share/fonts/truetype/lato/Lato-Semibold.ttf'
  const fadeOutStart = Math.max(0, voiceDuration - 0.35)
  const filter = [
    `[0:v]setsar=1,eq=contrast=1.03:saturation=1.05:gamma=1.01,drawbox=x=0:y=0:w=iw:h=410:color=black@0.30:t=fill:enable='between(t,0,3.5)',drawbox=x=72:y=122:w=180:h=5:color=0xF6C453@0.96:t=fill:enable='between(t,0,3.5)',drawtext=fontfile=${labelFont}:text='ONE MILLION SOULS':fontcolor=white@0.90:fontsize=27:x=72:y=68:enable='between(t,0,3.5)',drawtext=fontfile=${titleFont}:textfile=${titlePath}:fontcolor=white:fontsize=70:line_spacing=8:x=72:y=150:enable='between(t,0,3.5)',ass=${captions}:fontsdir=/usr/share/fonts/truetype/lato,drawbox=x=72:y=h-92:w=170:h=4:color=0xF6C453@0.88:t=fill,drawtext=fontfile=${labelFont}:text='ONE MILLION SOULS':fontcolor=white@0.82:fontsize=24:x=265:y=h-108,fade=t=in:st=0:d=0.30,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.35[v]`,
    '[1:a]highpass=f=80,lowpass=f=13500,acompressor=threshold=0.12:ratio=2.5:attack=20:release=180,volume=1.12[voice]',
    '[2:a]volume=0.10[music]',
    '[voice][music]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-16:LRA=7:TP=-1.5[a]',
  ].join(';')

  await execFileAsync('ffmpeg', [
    '-y', '-stream_loop', '-1', '-i', visualPath, '-i', voice.local, '-stream_loop', '-1', '-i', music.local,
    '-filter_threads', '1',
    '-filter_complex_threads', '1',
    '-filter_complex', filter,
    '-map', '[v]', '-map', '[a]', '-t', voiceDuration.toFixed(2),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-threads', '2', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out,
  ], { timeout: 420000, maxBuffer: 8 * 1024 * 1024 })

  const outStat = await fs.stat(out)
  if (outStat.size < 10000) throw new Error('Final master render produced an invalid MP4')

  return { out, duration: voiceDuration }
}

async function persist(file, id) {
  if (!s3) throw new Error('Persistent storage is required for render-v2')
  const key = `renders-v2/${new Date().toISOString().slice(0, 10)}/${id}.mp4`
  const bytes = await fs.readFile(file)
  await s3.send(new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: key,
    Body: bytes,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return `${publicBase()}/media/${key.split('/').map(encodeURIComponent).join('/')}`
}

export async function renderFreeV2(body = {}) {
  const id = crypto.randomUUID()
  const work = path.join(os.tmpdir(), 'one-million-souls-render-v2', id)
  await fs.mkdir(work, { recursive: true })

  const title = extractTitle(body)
  const script = extractScript(body)
  const providers = getFreeProviders()
  const prompts = scenePrompts(body, title, script)

  console.log('FREE_AI_V2_START', JSON.stringify({ id, title, sceneCount: prompts.length }))

  try {
    const voice = await generateVoice(providers, script, work)
    const voiceDuration = await mediaDuration(voice.local)
    console.log('FREE_AI_VOICE_READY', JSON.stringify({ id, provider: voice.provider, durationSeconds: Number(voiceDuration.toFixed(2)) }))

    const musicPromise = generateMusic(providers, voiceDuration, work)
    const scenes = []
    const sceneSeconds = Math.max(4.5, Math.min(6.5, (voiceDuration / prompts.length) + 0.2))
    for (let index = 0; index < prompts.length; index += 1) {
      const scene = await generateScene(providers, prompts[index], index, work, sceneSeconds)
      scenes.push(scene)
      console.log('FREE_AI_SCENE_READY', JSON.stringify({ id, index: index + 1, source: scene.source || 'unknown' }))
    }
    const music = await musicPromise
    console.log('FREE_AI_MUSIC_READY', JSON.stringify({ id, provider: music.provider || providers.music.name }))

    if (scenes.length < 3 || scenes.some((scene) => !scene?.local)) {
      throw new Error('Quality gate failed: at least three motion scenes are required')
    }
    if (scenes.some((scene) => scene.source === 'local-procedural-cinematic') &&
        process.env.ALLOW_PROCEDURAL_FALLBACK !== 'true') {
      throw new Error('Quality gate failed: procedural visuals are not production-approved')
    }

    const composed = await compose({ scenes, voice, music, script, title, work })
    const mediaUrl = await persist(composed.out, id)
    const sceneSources = scenes.map((scene) => scene.source || 'unknown')

    const result = {
      ok: true,
      renderer: 'one-million-souls-zero-credit-v3',
      mediaUrl,
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
      durationSeconds: Number(composed.duration.toFixed(2)),
      sceneCount: scenes.length,
      sceneSources,
      voiceProvider: voice.provider,
      imageProvider: sceneSources.some((source) => source === 'local-procedural-cinematic') ? 'procedural-test-only' : providers.image.name,
      videoProvider: sceneSources.some((source) => source === 'cloud-ai-video') ? 'hybrid Wan 2.2 + local cinematic motion' : 'local cinematic motion from AI stills',
      musicProvider: music.provider || providers.music.name,
      captionsPresent: true,
      narrationPresent: true,
      musicPresent: true,
      motionScenesPresent: true,
      paidGenerationCreditsUsed: false,
      persistentStorage: true,
      qualityGate: 'passed',
      designSystem: 'v4-lato-gold-ass-captions',
      publishingAllowed: false,
      reviewRequired: true,
    }
    console.log('FREE_AI_V2_RESULT', JSON.stringify(result))
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('FREE_AI_V2_FAILED', JSON.stringify({ id, error: message }))
    throw new Error(`render-v2 failed closed: ${message}`)
  }
}
