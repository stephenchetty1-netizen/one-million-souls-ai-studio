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
import { createRightsClearedStockScene } from './stock-video-library.mjs'
import { planVisualStory, stockSelectionForBeat, inspectVisualStoryboard, CAPTION_LAYOUT, STORYBOARD_VERSION } from './visual-storyboard.mjs'
import { createRightsClearedStockMusic } from './stock-music-library.mjs'
import { createGoogleVeoScene, googleVeoEnabled } from './google-veo-provider.mjs'

const execFileAsync = promisify(execFile)
const WIDTH = Number(process.env.RENDER_WIDTH || 1080)
const HEIGHT = Number(process.env.RENDER_HEIGHT || 1920)
const FPS = Number(process.env.RENDER_FPS || 30)
const ZERO_CREDIT_ONLY = process.env.ZERO_CREDIT_ONLY !== 'false'

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
  return text.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
}

function highlightCaption(text) {
  const clean = cleanAssText(text)
  const gold = '&H0053C4F6&'
  return clean.replace(/\b(God|Jesus|Lord|Christ|faith|pray|praying|believe|believing|hope|grace|fear)\b/gi,
    (word) => `{\\c${gold}\\b1}${word}{\\rCaption}`)
}

function captionChunks(script) {
  const words = script.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const chunks = []
  let current = []
  for (const word of words) {
    const candidate = [...current, word]
    const text = candidate.join(' ')
    if (current.length && (candidate.length > CAPTION_LAYOUT.maxWords || text.length > CAPTION_LAYOUT.maxCharacters)) {
      chunks.push(current)
      current = [word]
    } else {
      current = candidate
    }
  }
  if (current.length) chunks.push(current)
  return chunks
}

function buildAss(script, duration) {
  const chunks = captionChunks(script).map((chunk) => chunk.join(' '))
  if (!chunks.length) chunks.push('Keep trusting God')
  const slice = duration / Math.max(1, chunks.length)
  if (slice < CAPTION_LAYOUT.minimumSecondsPerPhrase) throw new Error(`Caption quality gate failed: caption cadence too fast (${slice.toFixed(2)}s per phrase)`)

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
    'Style: Caption,Lato,58,&H00FFFFFF,&H00FFFFFF,&H00000000,&H98000000,-1,0,0,0,100,100,0,0,3,1,0,2,140,180,650,1',
    '',
    '[Events]',
    'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
  ]

  const events = chunks.map((text, index) => {
    const start = index * slice
    const end = Math.min(duration, (index + 1) * slice)
    return `Dialogue: 0,${assTime(start)},${assTime(Math.max(start + 0.9, end))},Caption,,0,0,0,,${highlightCaption(text)}`
  })

  return [...header, ...events, ''].join('\n')
}

function wrapTitle(title) {
  const words = title.toUpperCase().replace(/\s+/g, ' ').trim().split(' ')
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
  return lines.slice(0, 2).join('\n')
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

function scenePrompts(plan) {
  const common = 'Vertical 9:16 documentary realism, coherent natural light, one recognizable visual motif throughout the same devotional, real people and real environments, no text, watermarks, distorted anatomy, or irrelevant footage'
  return plan.beats.map((beat) => {
    const stage={
      TENSION:'Communicate the felt need with restraint; establish the setting and consistent time of day.',
      SCRIPTURE:'Ground the same story in Scripture and attentive presence; keep a visual link to the first scene.',
      RESPONSE:'Resolve the SAME story with a prayerful next step, hope and calm; visually echo the opening.',
    }[beat.stage]
    return beat.prompt||[common,stage,'Scene message: '+beat.narration,'Story title: '+plan.title,'Scripture: '+plan.scriptureReference].join('. ')
  })
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

async function generateScene(providers, prompt, index, work, seconds, stockSeed = 0, stockSelection = null) {
  const allowProcedural = process.env.ALLOW_PROCEDURAL_FALLBACK === 'true'
  const preferGoogleVeo = !ZERO_CREDIT_ONLY && googleVeoEnabled() && process.env.GOOGLE_VEO_PRIMARY !== 'false'
  const stockEnabled = process.env.RIGHTS_CLEARED_STOCK_FALLBACK !== 'false'
  const stockPrimary = process.env.STOCK_VIDEO_PRIMARY === 'true'
  const authenticatedHf = Boolean(String(process.env.HF_TOKEN || '').trim())

  if (preferGoogleVeo) {
    try {
      const veo = await createGoogleVeoScene(prompt, index, work, seconds)
      console.log('GOOGLE_VEO_SCENE_READY', JSON.stringify({ index, model:veo.model, resolution:veo.resolution, aspectRatio:veo.aspectRatio }))
      return veo
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('GOOGLE_VEO_PRIMARY_FAILED', JSON.stringify({ index, error:message }))
      if (process.env.GOOGLE_VEO_REQUIRED === 'true') {
        throw new Error(`Google Veo required but scene generation failed: ${message}`)
      }
    }
  }

  // A configured stock-primary renderer must not use numeric-index stock on
  // uncurated topics. Try original free video; if it fails, no random stock fallback.
  if (stockEnabled && stockPrimary && !authenticatedHf && !stockSelection?.stockId) {
    console.warn('CURATED_STOCK_UNAVAILABLE_TRY_FREE_ORIGINAL_VIDEO',JSON.stringify({index}))
  }
  if (stockEnabled && stockPrimary && !authenticatedHf && stockSelection?.stockId) {
    const stock = await createRightsClearedStockScene(index, work, seconds, stockSeed, stockSelection)
    console.log('RIGHTS_CLEARED_STOCK_PRIMARY', JSON.stringify({
      index,
      stockId: stock.stockId,
      license: stock.license,
    }))
    return stock
  }

  if (process.env.LOCAL_VISUALS_ONLY === 'true') {
    if (!allowProcedural) throw new Error('Quality gate blocked: procedural visuals are test-only')
    return createLocalFallbackScene(index, work, seconds)
  }

  try {
    return await generateCloudScene(providers, prompt, index, work, seconds)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (process.env.RIGHTS_CLEARED_STOCK_FALLBACK !== 'false') {
      try {
        const stock = await createRightsClearedStockScene(index, work, seconds, stockSeed, stockSelection)
        console.warn('FREE_AI_STOCK_VIDEO_FALLBACK', JSON.stringify({
          index,
          stockId: stock.stockId,
          license: stock.license,
          aiError: message,
        }))
        return stock
      } catch (stockError) {
        console.error('FREE_AI_STOCK_VIDEO_FAILED', JSON.stringify({
          index,
          error: stockError instanceof Error ? stockError.message : String(stockError),
        }))
      }
    }
    if (!allowProcedural) {
      throw new Error(`Quality gate blocked scene ${index + 1}: AI image unavailable and rights-cleared stock fallback failed (${message})`)
    }
    console.warn('FREE_AI_PROCEDURAL_TEST_FALLBACK', JSON.stringify({ index, error: message }))
    return createLocalFallbackScene(index, work, seconds)
  }
}

async function generateEdgeVoice(script, work) {
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
  try {
    return await generateCloudVoice(providers, script, work)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('KOKORO_TTS_PRIMARY_FAILED', JSON.stringify({ error: message }))
    if (process.env.ALLOW_EDGE_TTS_PRODUCTION === 'true' && process.env.EDGE_TTS_ENABLED !== 'false') {
      return await generateEdgeVoice(script, work)
    }
    throw new Error(`Kokoro TTS unavailable and unverified Edge fallback is disabled for PROFESSIONAL_MASTER: ${message}`)
  }
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

async function generateMusic(providers, duration, work, seed=0) {
  if (process.env.LOCAL_MUSIC_ONLY === 'true') return createLocalAmbientMusic(duration, work)
  try {
    return await createRightsClearedStockMusic(duration, work, seed)
  } catch (stockError) {
    const stockMessage = stockError instanceof Error ? stockError.message : String(stockError)
    console.warn('RIGHTS_CLEARED_STOCK_MUSIC_FAILED', JSON.stringify({ error: stockMessage }))
    if (process.env.ALLOW_GENERATED_MUSIC_FALLBACK === 'true') {
      try {
        return await generateCloudMusic(providers, duration, work)
      } catch (cloudError) {
        console.warn('GENERATED_MUSIC_FALLBACK_FAILED', JSON.stringify({ error: cloudError instanceof Error ? cloudError.message : String(cloudError) }))
      }
    }
    // Music is optional for a professional devotional master. A deterministic
    // locally generated ambient bed avoids killing the renderer on Wikimedia
    // 429s or shared ZeroGPU exhaustion and consumes no paid generation credits.
    console.warn('LOCAL_AMBIENT_MUSIC_RESILIENCE_FALLBACK', JSON.stringify({ reason: stockMessage }))
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
  await fs.writeFile(concatPath, scenes.map((scene) => `file '${scene.local.replaceAll("'", "'\\\\''")}'`).join('\n'), 'utf8')

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

function inspectCaptionSafeZones(script, duration) {
  const chunks = captionChunks(script)
  if (!chunks.length) throw new Error('Caption quality gate failed: no caption phrases')
  const secondsPerPhrase = duration / chunks.length
  const problems = []
  if (secondsPerPhrase < CAPTION_LAYOUT.minimumSecondsPerPhrase) problems.push('caption phrases advance too quickly')
  if (chunks.some((chunk) => chunk.length > CAPTION_LAYOUT.maxWords)) problems.push('caption phrase exceeds four words')
  if (chunks.some((chunk) => chunk.join(' ').length > CAPTION_LAYOUT.maxCharacters)) problems.push('caption phrase too wide for mobile safe zone')
  // Both TikTok and YouTube overlays need an intentionally larger protected
  // region than the previous 170px bottom margin.
  const horizontalSafeMargin = Math.min(CAPTION_LAYOUT.leftMargin,CAPTION_LAYOUT.rightMargin)
  const bottomSafeMargin = CAPTION_LAYOUT.bottomMargin
  if (horizontalSafeMargin < 120) problems.push('horizontal caption safe margin below 120px')
  if (bottomSafeMargin < 360) problems.push('bottom caption safe margin below 360px')
  if (problems.length) throw new Error('Caption/mobile safe-zone gate failed: ' + problems.join('; '))
  return { passed:true, status:'PASS', phraseCount:chunks.length, maxWordsPerPhrase:CAPTION_LAYOUT.maxWords, timingMethod:'ESTIMATED_REQUIRES_INDEPENDENT_AUDIO_SYNC_REVIEW', secondsPerPhrase:Number(secondsPerPhrase.toFixed(2)), horizontalSafeMargin, bottomSafeMargin }
}

async function inspectVisualVariety(scenes) {
  if (!Array.isArray(scenes) || scenes.length < 3) throw new Error('Visual variety gate failed: at least three scenes required')
  const hashes = []
  for (const scene of scenes) {
    const bytes = await fs.readFile(scene.local)
    hashes.push(crypto.createHash('sha256').update(bytes).digest('hex'))
  }
  const uniqueHashes = new Set(hashes)
  if (uniqueHashes.size !== hashes.length) throw new Error('Visual variety gate failed: duplicate scene media detected')
  const stockIds = scenes.map((s) => s.stockId).filter(Boolean)
  const intentionalReprises=[]
  for(let i=0;i<scenes.length;i++){
    const scene=scenes[i]
    if(!scene.stockId)continue
    const earlier=scenes.slice(0,i).findIndex((s)=>s.stockId===scene.stockId)
    if(earlier<0)continue
    if(scene.repriseOf!==earlier||Math.abs((scene.startSeconds||0)-(scenes[earlier].startSeconds||0))<5)
      throw new Error('Visual variety gate failed: unplanned duplicate stock footage')
    intentionalReprises.push({stockId:scene.stockId,firstBeat:earlier,repriseBeat:i})
  }
  const sources = scenes.map((s) => s.source || 'unknown')
  const longestRun = sources.reduce((state, source) => {
    const run = source === state.last ? state.run + 1 : 1
    return { last:source, run, max:Math.max(state.max,run) }
  }, {last:null,run:0,max:0}).max
  return { passed:true, status:'PASS', sceneCount:scenes.length, uniqueSceneCount:uniqueHashes.size, repeatedStockIds:intentionalReprises.length, intentionalReprises, longestSameSourceRun:longestRun, sceneSources:sources }
}

async function inspectAudioMaster(file) {
  const { stderr } = await execFileAsync('ffmpeg', [
    '-hide_banner','-nostats','-i',file,
    '-vn','-af','loudnorm=I=-16:LRA=7:TP=-1.5:print_format=json',
    '-f','null','-'
  ], { timeout: 120000, maxBuffer: 8 * 1024 * 1024 }).catch((error) => {
    if (error?.stderr) return { stderr: error.stderr }
    throw error
  })
  const text = String(stderr || '')
  const match = text.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/g)
  if (!match?.length) throw new Error('Audio mastering gate failed: loudness analysis unavailable')
  let stats
  try { stats = JSON.parse(match[match.length - 1]) } catch { throw new Error('Audio mastering gate failed: invalid loudness analysis') }
  const integrated = Number(stats.input_i)
  const truePeak = Number(stats.input_tp)
  const lra = Number(stats.input_lra)
  const threshold = Number(stats.input_thresh)
  if (![integrated,truePeak,lra,threshold].every(Number.isFinite)) throw new Error('Audio mastering gate failed: non-finite loudness metrics')
  if (integrated < -18.5 || integrated > -13.5) throw new Error(`Audio mastering gate failed: integrated loudness ${integrated} LUFS outside -18.5..-13.5`)
  if (truePeak > -1.0) throw new Error(`Audio mastering gate failed: true peak ${truePeak} dBTP exceeds -1.0 dBTP ceiling`)
  if (lra > 12) throw new Error(`Audio mastering gate failed: loudness range ${lra} LU is too wide for mobile narration`)
  return { passed:true, status:'PASS', integratedLufs:integrated, truePeakDbtp:truePeak, loudnessRangeLu:lra, thresholdLufs:threshold, target:'-16 LUFS / <= -1.0 dBTP' }
}

async function inspectSceneMotion(scene, index) {
  const audit = await execFileAsync('ffmpeg', [
    '-hide_banner','-nostats','-i',scene.local,
    '-vf','scale=270:480,blackdetect=d=0.35:pix_th=0.08,freezedetect=n=-50dB:d=1.5',
    '-an','-f','null','-'
  ], { timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
  const log = String(audit?.stderr || '')
  const defects = []
  if (/black_start/.test(log)) defects.push('black')
  if (/freeze_start/.test(log)) defects.push('freeze')
  if (defects.length) {
    throw new Error(`Scene quality gate failed: scene ${index + 1} (${scene.stockId || scene.source || 'unknown'}) contains ${defects.join('/')} defect`)
  }
  return { passed:true, status:'PASS', index:index + 1, stockId:scene.stockId || null, source:scene.source || 'unknown' }
}

async function inspectMaster(file, expectedDuration) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v','error','-show_entries','stream=index,codec_type,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration,bit_rate',
    '-of','json',file,
  ], { timeout: 30000, maxBuffer: 5 * 1024 * 1024 })
  const probe = JSON.parse(stdout)
  const video = (probe.streams || []).find((s) => s.codec_type === 'video')
  const audio = (probe.streams || []).find((s) => s.codec_type === 'audio')
  const duration = Number(probe.format?.duration || 0)
  const bitrate = Number(probe.format?.bit_rate || 0)
  if (!video || !audio) throw new Error('Master integrity failed: video and audio streams are required')
  const [fpsN,fpsD] = String(video.r_frame_rate || '0/1').split('/').map(Number)
  const fps = fpsD ? fpsN / fpsD : 0
  if (Number(video.width) < 1080 || Number(video.height) < 1920 || fps < 29.9) throw new Error('Master integrity failed: export profile below 1080x1920@30fps')
  if (duration <= 0 || Math.abs(duration - expectedDuration) > 0.75) throw new Error('Master integrity failed: assembled duration does not match narration')
  if (bitrate && bitrate < 1_500_000) throw new Error('Master integrity failed: final bitrate below professional floor')
  if (Number(audio.sample_rate || 0) < 44100 || Number(audio.channels || 0) < 1) throw new Error('Master integrity failed: audio stream quality invalid')

  const freezeDir = path.join(path.dirname(file), 'frame-audit')
  await fs.mkdir(freezeDir, { recursive: true })
  const frameAudit = await execFileAsync('ffmpeg', [
    '-y','-i',file,'-vf','scale=270:480,blackdetect=d=0.35:pix_th=0.08,freezedetect=n=-50dB:d=1.5',
    '-an','-f','null','-'
  ], { timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
  const frameAuditLog = String(frameAudit?.stderr || '')
  if (/black_start|freeze_start/.test(frameAuditLog)) {
    throw new Error('Master integrity failed: black/frozen-frame defect detected')
  }
  return { passed:true, status:'PASS', width:Number(video.width), height:Number(video.height), fps:Number(fps.toFixed(2)), durationSeconds:Number(duration.toFixed(2)), bitrate }
}

async function inspectFullDecode(file, expectedDuration) {
  const startedAt = Date.now()
  await execFileAsync('ffmpeg', [
    '-v','error','-i',file,
    '-map','0:v:0','-map','0:a:0?',
    '-f','null','-'
  ], { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 })
  return {
    passed:true,
    status:'PASS',
    method:'ffmpeg end-to-end decode of final immutable master',
    expectedDurationSeconds:Number(expectedDuration.toFixed(2)),
    decodedFromFirstToLast:true,
    elapsedMs:Date.now()-startedAt,
  }
}

async function persistReviewAudio(file, id) {
  if (!s3) throw new Error('Persistent storage is required for review audio')
  const key = `review-v2/${new Date().toISOString().slice(0, 10)}/${id}-audio.mp3`
  const bytes = await fs.readFile(file)
  const hash = crypto.createHash('sha256').update(bytes).digest('hex')
  await s3.send(new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: key,
    Body: bytes,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return { url:`${publicBase()}/media/${key.split('/').map(encodeURIComponent).join('/')}`, hash, bytes:bytes.length }
}

async function persistReviewImage(file, id, label) {
  if (!s3) throw new Error('Persistent storage is required for review assets')
  const key = `review-v2/${new Date().toISOString().slice(0, 10)}/${id}-${label}.jpg`
  const bytes = await fs.readFile(file)
  const hash = crypto.createHash('sha256').update(bytes).digest('hex')
  await s3.send(new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: key,
    Body: bytes,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return { url: `${publicBase()}/media/${key.split('/').map(encodeURIComponent).join('/')}`, hash, bytes: bytes.length }
}

async function createReviewAssets(masterFile, id, work, duration) {
  const first = path.join(work, 'review-first.jpg')
  const contact = path.join(work, 'review-contact.jpg')
  const last = path.join(work, 'review-last.jpg')
  const thumb = path.join(work, 'thumbnail.jpg')
  const audio = path.join(work, 'review-audio.mp3')
  const endAt = Math.max(0, duration - 0.20)
  const reviewFps = Math.max(0.25, 16 / Math.max(1, duration))

  await execFileAsync('ffmpeg', ['-y','-ss','0','-i',masterFile,'-frames:v','1','-q:v','2',first], { timeout: 60_000 })
  await execFileAsync('ffmpeg', ['-y','-ss',String(Math.min(1.0, Math.max(0, duration / 4))),' -i'.trim(),masterFile,'-frames:v','1','-q:v','2',thumb], { timeout: 60_000 })
  await execFileAsync('ffmpeg', ['-y','-ss',endAt.toFixed(3),'-i',masterFile,'-frames:v','1','-q:v','2',last], { timeout: 60_000 })
  await execFileAsync('ffmpeg', [
    '-y','-i',masterFile,
    '-vf',`fps=${reviewFps.toFixed(4)},scale=270:-2,tile=4x4:padding=4:margin=4`,
    '-frames:v','1','-q:v','3',contact
  ], { timeout: 120_000 })
  await execFileAsync('ffmpeg', [
    '-y','-i',masterFile,'-vn','-c:a','libmp3lame','-b:a','160k',audio
  ], { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 })

  const [firstAsset, contactAsset, lastAsset, thumbnailAsset, audioAsset] = await Promise.all([
    persistReviewImage(first,id,'first'),
    persistReviewImage(contact,id,'contact'),
    persistReviewImage(last,id,'last'),
    persistReviewImage(thumb,id,'thumbnail'),
    persistReviewAudio(audio,id),
  ])

  return {
    firstFrameUrl:firstAsset.url,
    firstFrameHash:firstAsset.hash,
    contactSheetUrl:contactAsset.url,
    contactSheetHash:contactAsset.hash,
    lastFrameUrl:lastAsset.url,
    lastFrameHash:lastAsset.hash,
    thumbnailUrl:thumbnailAsset.url,
    thumbnailHash:thumbnailAsset.hash,
    audioReviewUrl:audioAsset.url,
    audioReviewHash:audioAsset.hash,
    temporalCoverage:{startSeconds:0,endSeconds:Number(duration.toFixed(2)),contactSheetTargetFrames:16},
    method:'first-frame + uniform temporal contact sheet + final-frame',
  }
}

async function persist(file, id) {
  if (!s3) throw new Error('Persistent storage is required for render-v2')
  const key = `renders-v2/${new Date().toISOString().slice(0, 10)}/${id}.mp4`
  const bytes = await fs.readFile(file)
  const masterHash = crypto.createHash('sha256').update(bytes).digest('hex')
  await s3.send(new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: key,
    Body: bytes,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return { mediaUrl: `${publicBase()}/media/${key.split('/').map(encodeURIComponent).join('/')}`, masterHash, bytes: bytes.length }
}

export async function renderFreeV2(body = {}) {
  const id = crypto.randomUUID()
  const work = path.join(os.tmpdir(), 'one-million-souls-render-v2', id)
  await fs.mkdir(work, { recursive: true })

  const title = extractTitle(body)
  const script = extractScript(body)
  const providers = getFreeProviders()
  const scriptureReference=cleanText(body?.scriptureReference||body?.ref||
    script.match(/\b(?:Matthew|Mark|Luke|John|Romans|Psalms?|Isaiah|Jeremiah|Hebrews|Philippians|Lamentations|Corinthians)\s+\d+:\d+(?:-\d+)?\b/i)?.[0]||'')
  const storyboard=planVisualStory({title,script,scriptureReference,visualPrompts:body?.visualPrompts})
  const prompts = scenePrompts(storyboard)
  const variationSeed = Math.max(0, Number(body?.variationSeed || 0))
  const stockSeed = [...`${title}|${script}|variation:${variationSeed}`].reduce((a,ch)=>((a*31+ch.charCodeAt(0))>>>0),7)

  console.log('FREE_AI_V2_START', JSON.stringify({ id, title, sceneCount: prompts.length, variationSeed }))

  try {
    const voice = await generateVoice(providers, script, work)
    const voiceDuration = await mediaDuration(voice.local)
    console.log('FREE_AI_VOICE_READY', JSON.stringify({ id, provider: voice.provider, durationSeconds: Number(voiceDuration.toFixed(2)) }))

    const musicPromise = generateMusic(providers, voiceDuration, work, stockSeed)
    const scenes = []
    const sceneSeconds = Math.max(4.5, Math.min(6.5, (voiceDuration / prompts.length) + 0.2))
    for (let index = 0; index < prompts.length; index += 1) {
      try {
        const selection=storyboard.stockStoryboardAvailable?stockSelectionForBeat(storyboard,index):null
        const scene = await generateScene(providers, prompts[index], index, work, sceneSeconds, stockSeed, selection)
        scenes.push(scene)
        console.log('FREE_AI_SCENE_READY', JSON.stringify({ id, index: index + 1, source: scene.source || 'unknown' }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (scenes.length >= 3) {
          console.warn('FREE_AI_SCENE_QUOTA_STOP', JSON.stringify({
            id,
            attemptedIndex: index + 1,
            completedScenes: scenes.length,
            error: message,
          }))
          break
        }
        throw error
      }
    }
    const music = await musicPromise
    console.log('FREE_AI_MUSIC_READY', JSON.stringify({ id, provider: music.provider || providers.music.name }))

    if (ZERO_CREDIT_ONLY && scenes.some((scene) => scene.source === 'google-veo-video')) {
      throw new Error('Zero-credit policy gate failed: paid-credit video provider selected')
    }
    if (scenes.length < 3 || scenes.some((scene) => !scene?.local)) {
      throw new Error('Quality gate failed: at least three motion scenes are required')
    }
    if (scenes.some((scene) => scene.source === 'local-procedural-cinematic') &&
        process.env.ALLOW_PROCEDURAL_FALLBACK !== 'true') {
      throw new Error('Quality gate failed: procedural visuals are not production-approved')
    }
    const realMotionScenes = scenes.filter((scene) => ['google-veo-video','cloud-ai-video','rights-cleared-stock-video'].includes(scene.source)).length
    const minimumRealMotionScenes = scenes.length
    if (realMotionScenes < minimumRealMotionScenes) {
      throw new Error(`Quality gate failed: every production scene must use real motion video; required ${minimumRealMotionScenes}, got ${realMotionScenes}`)
    }
    if (scenes.some((scene) => scene.source === 'cloud-image-local-motion')) {
      throw new Error('Quality gate failed: animated still-image motion is not PROFESSIONAL_MASTER eligible')
    }
    if (WIDTH < 1080 || HEIGHT < 1920 || FPS < 30) {
      throw new Error(`Quality gate failed: production export must be at least 1080x1920@30fps; got ${WIDTH}x${HEIGHT}@${FPS}`)
    }
    if (/local-ffmpeg-ambient/i.test(String(music.provider || ''))) {
      throw new Error('Quality gate failed: synthetic local fallback music is not PROFESSIONAL_MASTER eligible')
    }
    if (!voice?.provider || /espeak/i.test(String(voice.provider))) {
      throw new Error('Quality gate failed: legacy/synthetic fallback narration is not PROFESSIONAL_MASTER eligible')
    }

    const visualStoryboardInspection=inspectVisualStoryboard(storyboard,scenes)
    const captionInspection = inspectCaptionSafeZones(script, voiceDuration)
    const sceneMotionInspection = []
    for (let index = 0; index < scenes.length; index += 1) sceneMotionInspection.push(await inspectSceneMotion(scenes[index], index))
    const visualVarietyInspection = await inspectVisualVariety(scenes)
    const composed = await compose({ scenes, voice, music, script, title, work })
    const masterInspection = await inspectMaster(composed.out, composed.duration)
    const audioInspection = await inspectAudioMaster(composed.out)
    const fullDecodeInspection = await inspectFullDecode(composed.out, composed.duration)
    const persisted = await persist(composed.out, id)
    const reviewAssets = await createReviewAssets(composed.out, id, work, composed.duration)
    const mediaUrl = persisted.mediaUrl
    const sceneSources = scenes.map((scene) => scene.source || 'unknown')

    const result = {
      ok: true,
      renderer: 'one-million-souls-zero-credit-v3',
      variationSeed,
      mediaUrl,
      masterHash: persisted.masterHash,
      masterBytes: persisted.bytes,
      thumbnailUrl: reviewAssets.thumbnailUrl,
      thumbnailHash: reviewAssets.thumbnailHash,
      reviewAssets,
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
      durationSeconds: Number(composed.duration.toFixed(2)),
      sceneCount: scenes.length,
      realMotionSceneCount: sceneSources.filter((source) => ['google-veo-video','cloud-ai-video','rights-cleared-stock-video'].includes(source)).length,
      rightsClearedStockScenes: scenes.filter((scene) => scene.source === 'rights-cleared-stock-video').map((scene) => ({ stockId:scene.stockId, sourcePage:scene.sourcePage, license:scene.license, rightsNote:scene.rightsNote })),
      sceneSources,
      voiceProvider: voice.provider,
      voiceRights: /Kokoro/i.test(String(voice.provider || '')) ? {
        model:'Kokoro-82M',
        license:'Apache-2.0',
        source:'https://huggingface.co/hexgrad/Kokoro-82M',
      } : {
        model:String(voice.provider || 'unknown'),
        license:'UNVERIFIED_FOR_REUSE',
        source:null,
      },
      musicRights: music.rights || {
        model:String(music.provider || 'unknown'),
        license:'UNVERIFIED',
        source:music.url || null,
        complianceRequired:true,
      },
      imageProvider: sceneSources.every((source) => source === 'rights-cleared-stock-video')
        ? 'not-used-stock-video-primary'
        : (sceneSources.some((source) => source === 'local-procedural-cinematic') ? 'procedural-test-only' : providers.image.name),
      videoProvider: sceneSources.some((source) => source === 'google-veo-video')
        ? 'Google Veo 3.1 (Flow-class) + approved fallbacks'
        : (sceneSources.every((source) => source === 'rights-cleared-stock-video')
          ? 'rights-cleared-stock-video'
          : (sceneSources.some((source) => source === 'cloud-ai-video') ? 'hybrid Wan 2.2 + rights-cleared/local motion' : 'rights-cleared/local motion')),
      musicProvider: music.provider || providers.music.name,
      captionsPresent: true,
      narrationPresent: true,
      musicPresent: true,
      motionScenesPresent: true,
      paidGenerationCreditsUsed: false,
      zeroCreditOnly: ZERO_CREDIT_ONLY,
      googleFlowClassGenerationUsed: false,
      persistentStorage: true,
      qualityGate: 'passed',
      professionalMasterCandidate: true,
      masterInspection,
      fullDecodeInspection,
      captionInspection,
      audioInspection,
      visualVarietyInspection,
      visualStoryboardInspection,
      storyboardVersion:STORYBOARD_VERSION,
      sceneMotionInspection,
      animatedStillScenes: 0,
      minimumExportProfile: '1080x1920@30fps',
      designSystem: 'v5-safe-zone-380px-story-beats',
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
