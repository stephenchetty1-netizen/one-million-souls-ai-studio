import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { KokoroTTS } from 'kokoro-js'
import { getFreeProviders } from './free-ai-providers.mjs'
import { callGradio, collectAssetUrls, uploadRemoteFileToGradio } from './free-ai-gradio.mjs'
import { createLocalFallbackScene, createLocalAmbientMusic } from './local-media-fallback.mjs'

const execFileAsync = promisify(execFile)
const WIDTH = Number(process.env.RENDER_WIDTH || 1080)
const HEIGHT = Number(process.env.RENDER_HEIGHT || 1920)
const FPS = Number(process.env.RENDER_FPS || 30)
let localKokoroPromise = null

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

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const x = ms % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(x).padStart(3, '0')}`
}

function buildSrt(script, duration) {
  const words = script.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const chunks = []
  for (let i = 0; i < words.length; i += 6) chunks.push(words.slice(i, i + 6).join(' '))
  const slice = Math.max(1.1, duration / Math.max(1, chunks.length))
  return chunks.map((text, i) => {
    const start = i * slice
    const end = Math.min(duration, Math.max(start + 0.8, (i + 1) * slice))
    return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${text}\n`
  }).join('\n')
}

async function download(url, target, timeoutMs = 120000) {
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
  const supplied = Array.isArray(body?.visualPrompts) ? body.visualPrompts.filter((x) => typeof x === 'string' && x.trim()) : []
  if (supplied.length >= 3) return supplied.slice(0, 3)
  const base = `${title}. ${script.slice(0, 280)}`
  return [
    `cinematic Christian encouragement, ${base}, sunrise over mountains, hopeful natural golden light, realistic photography, detailed, vertical 9:16, no text, no watermark`,
    `cinematic close-up of an open Bible beside soft morning window light, peaceful prayer atmosphere, ${base}, realistic photography, shallow depth of field, vertical 9:16, no text, no watermark`,
    `cinematic person standing in a vast natural landscape facing bright sunrise, hopeful faith journey, ${base}, realistic photography, subtle clouds and light rays, vertical 9:16, no text, no watermark`,
  ]
}

async function generateCloudScene(providers, prompt, index, work) {
  const imageOutput = await callGradio(providers.image.baseUrl, '/infer', [
    prompt, 100 + index, true, 576, 1024, 4,
  ], 240000)
  const imageUrl = collectAssetUrls(imageOutput)[0]
  if (!imageUrl) throw new Error(`Scene ${index + 1}: image provider returned no asset`)

  const image = await uploadRemoteFileToGradio(providers.video.baseUrl, imageUrl, `scene-${index + 1}.webp`)
  const videoOutput = await callGradio(providers.video.baseUrl, '/generate_video', [
    image,
    'slow cinematic camera push, subtle natural motion, realistic clouds and light movement, gentle parallax, peaceful inspirational mood, preserve scene structure',
    4,
    'distorted text, warped objects, flicker, jitter, low quality, extra limbs, duplicated objects',
    5, 3.5, 3.5, 200 + index, true,
  ], 480000)
  const videoUrl = collectAssetUrls(videoOutput)[0]
  if (!videoUrl) throw new Error(`Scene ${index + 1}: video provider returned no asset`)
  const local = path.join(work, `scene-${index + 1}.mp4`)
  await download(videoUrl, local, 120000)
  return { imageUrl, videoUrl, local, source: 'cloud-ai' }
}

async function generateScene(providers, prompt, index, work) {
  if (process.env.LOCAL_VISUALS_ONLY === 'true') {
    return createLocalFallbackScene(index, work, 5)
  }

  try {
    return await generateCloudScene(providers, prompt, index, work)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('FREE_AI_SCENE_FALLBACK', JSON.stringify({ index, error: message }))
    return createLocalFallbackScene(index, work, 5)
  }
}

async function getLocalKokoro() {
  if (!localKokoroPromise) {
    const modelId = process.env.LOCAL_KOKORO_MODEL || 'onnx-community/Kokoro-82M-v1.0-ONNX'
    localKokoroPromise = KokoroTTS.from_pretrained(modelId, {
      dtype: process.env.LOCAL_KOKORO_DTYPE || 'q8',
      device: 'cpu',
    })
  }
  return localKokoroPromise
}

async function generateVoice(providers, script, work) {
  const localEnabled = process.env.LOCAL_KOKORO_ENABLED !== 'false'
  if (localEnabled) {
    const tts = await getLocalKokoro()
    const voiceName = process.env.LOCAL_KOKORO_VOICE || 'af_heart'
    const output = await tts.generate(script, { voice: voiceName })
    const local = path.join(work, 'voice.wav')
    await output.save(local)
    const stat = await fs.stat(local)
    if (stat.size < 1000) throw new Error('Local Kokoro produced an invalid WAV')
    return { url: null, local, provider: `Kokoro 82M local CPU (${voiceName})` }
  }

  const output = await callGradio(providers.voice.baseUrl, '/generate_all', [
    script,
    process.env.FREE_TTS_VOICE || 'bm_george',
    Number(process.env.FREE_TTS_SPEED || 0.95),
    true,
  ], 240000)
  const url = collectAssetUrls(output)[0]
  if (!url) throw new Error('Voice provider returned no audio asset')
  const local = path.join(work, 'voice.wav')
  await download(url, local, 120000)
  return { url, local, provider: providers.voice.name }
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
  if (process.env.LOCAL_MUSIC_ONLY === 'true') {
    return createLocalAmbientMusic(duration, work)
  }

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
  const captions = path.join(work, 'captions.srt')
  const titlePath = path.join(work, 'title.txt')
  const concatPath = path.join(work, 'concat.txt')
  const visualPath = path.join(work, 'visuals.mp4')
  const out = path.join(work, 'master.mp4')

  await fs.writeFile(captions, buildSrt(script, voiceDuration), 'utf8')
  await fs.writeFile(titlePath, title, 'utf8')
  await fs.writeFile(concatPath, scenes.map((s) => `file '${s.local.replaceAll("'", "'\\''")}'`).join('\n'), 'utf8')

  await execFileAsync('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-vf', `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},fps=${FPS}`,
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', visualPath,
  ], { timeout: 300000, maxBuffer: 30 * 1024 * 1024 })

  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  const filter = [
    `[0:v]scale=${WIDTH}:${HEIGHT},setsar=1,subtitles=${captions}:force_style='FontName=DejaVu Sans,FontSize=17,PrimaryColour=&H00FFFFFF,OutlineColour=&H99000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=175',drawtext=fontfile=${font}:textfile=${titlePath}:fontcolor=white:fontsize=54:x=(w-text_w)/2:y=105:box=1:boxcolor=black@0.32:boxborderw=18,drawtext=fontfile=${font}:text='ONE MILLION SOULS':fontcolor=white@0.88:fontsize=26:x=(w-text_w)/2:y=h-80[v]`,
    `[1:a]volume=1.0[voice]`,
    `[2:a]volume=0.13[music]`,
    `[voice][music]amix=inputs=2:duration=first:dropout_transition=2[a]`,
  ].join(';')

  await execFileAsync('ffmpeg', [
    '-y', '-stream_loop', '-1', '-i', visualPath, '-i', voice.local, '-stream_loop', '-1', '-i', music.local,
    '-filter_complex', filter,
    '-map', '[v]', '-map', '[a]', '-t', voiceDuration.toFixed(2),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out,
  ], { timeout: 420000, maxBuffer: 40 * 1024 * 1024 })

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

    const musicPromise = generateMusic(providers, voiceDuration, work)
    const scenes = []
    for (let index = 0; index < prompts.length; index += 1) {
      scenes.push(await generateScene(providers, prompts[index], index, work))
    }
    const music = await musicPromise

    if (scenes.length < 3 || scenes.some((scene) => !scene?.local)) {
      throw new Error('Quality gate failed: three motion scenes are required')
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
      imageProvider: sceneSources.every((source) => source === 'cloud-ai') ? providers.image.name : 'hybrid/local fallback',
      videoProvider: sceneSources.every((source) => source === 'cloud-ai') ? providers.video.name : 'hybrid/local FFmpeg motion',
      musicProvider: music.provider || providers.music.name,
      captionsPresent: true,
      narrationPresent: true,
      musicPresent: true,
      motionScenesPresent: true,
      paidGenerationCreditsUsed: false,
      persistentStorage: true,
      qualityGate: 'passed',
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
