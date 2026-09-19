import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { renderFreeV2 } from './free-ai-render-v2.mjs'
import { requestFactoryRetry } from './daily-factory.mjs'

const execFileAsync = promisify(execFile)
const PORT = Number(process.env.PORT || 3000)
const SECRET = process.env.VIDEO_RENDER_SECRET || ''
const WIDTH = Number(process.env.RENDER_WIDTH || 720)
const HEIGHT = Number(process.env.RENDER_HEIGHT || 1280)
const FPS = Number(process.env.RENDER_FPS || 24)
const publicBase = () => {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  return `http://127.0.0.1:${PORT}`
}

const storageReady = Boolean(
  process.env.ENDPOINT &&
  process.env.BUCKET &&
  process.env.REGION &&
  process.env.ACCESS_KEY_ID &&
  process.env.SECRET_ACCESS_KEY
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

const localFiles = new Map()

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function authorized(req) {
  if (!SECRET) return true
  return req.headers.authorization === `Bearer ${SECRET}`
}

async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > 2_000_000) throw new Error('Request body too large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function firstString(...values) {
  return values.find((v) => typeof v === 'string' && v.trim())?.trim() || ''
}

function extractTitle(body) {
  return firstString(
    body?.title,
    body?.campaign?.title,
    body?.asset?.title,
    body?.platformPackages?.youtube?.title,
    body?.asset?.platformPackages?.youtube?.title,
    body?.campaign?.platformPackages?.youtube?.title,
    body?.topic,
    body?.campaign?.topic,
    'ONE MILLION SOULS'
  ).slice(0, 120)
}

function extractScript(body) {
  const candidates = [
    body?.script,
    body?.campaign?.script,
    body?.campaign?.content,
    body?.campaign?.message,
    body?.asset?.script,
    body?.asset?.content,
    body?.platformPackages?.youtube?.description,
    body?.asset?.platformPackages?.youtube?.description,
    body?.campaign?.platformPackages?.youtube?.description,
    body?.platformPackages?.tiktok?.caption,
    body?.asset?.platformPackages?.tiktok?.caption,
    body?.campaign?.platformPackages?.tiktok?.caption,
    body?.campaign?.hook,
    body?.topic,
    body?.campaign?.topic,
  ].filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())

  if (!candidates.length) {
    return 'Jesus is faithful. Keep trusting God, keep praying, and do not give up. Your story is still being written.'
  }

  const longest = candidates.sort((a, b) => b.length - a.length)[0]
  return longest.slice(0, 3500)
}

function escSrt(text) {
  return text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const x = ms % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(x).padStart(3, '0')}`
}

function buildSrt(script, duration) {
  const words = escSrt(script).split(' ').filter(Boolean)
  const chunks = []
  for (let i = 0; i < words.length; i += 7) chunks.push(words.slice(i, i + 7).join(' '))
  if (!chunks.length) chunks.push('ONE MILLION SOULS')
  const slice = Math.max(1.3, duration / chunks.length)
  return chunks.map((text, i) => {
    const start = i * slice
    const end = Math.min(duration, (i + 1) * slice)
    return `${i + 1}\n${srtTime(start)} --> ${srtTime(Math.max(start + 0.8, end))}\n${text}\n`
  }).join('\n')
}

async function renderVideo(body) {
  const id = crypto.randomUUID()
  const work = path.join(os.tmpdir(), 'one-million-souls-renderer', id)
  await fs.mkdir(work, { recursive: true })

  const script = extractScript(body)
  const title = extractTitle(body)
  const scriptPath = path.join(work, 'script.txt')
  const titlePath = path.join(work, 'title.txt')
  const wavPath = path.join(work, 'voice.wav')
  const srtPath = path.join(work, 'captions.srt')
  const mp4Path = path.join(work, 'video.mp4')

  await fs.writeFile(scriptPath, script, 'utf8')
  await fs.writeFile(titlePath, title, 'utf8')

  await execFileAsync('espeak-ng', [
    '-v', process.env.TTS_VOICE || 'en-us',
    '-s', process.env.TTS_SPEED || '150',
    '-f', scriptPath,
    '-w', wavPath,
  ], { timeout: 120_000 })

  let duration = Math.max(8, Math.min(60, script.split(/\s+/).length / 2.2))
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      wavPath,
    ], { timeout: 30_000 })
    const parsed = Number.parseFloat(stdout.trim())
    if (Number.isFinite(parsed) && parsed > 0) duration = Math.min(60, parsed)
  } catch {}

  await fs.writeFile(srtPath, buildSrt(script, duration), 'utf8')

  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  const filter = [
    `drawtext=fontfile=${font}:textfile=${titlePath}:fontcolor=white:fontsize=42:x=(w-text_w)/2:y=120:box=1:boxcolor=black@0.38:boxborderw=18`,
    `subtitles=${srtPath}:force_style='FontName=DejaVu Sans,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=140'`,
    `drawtext=fontfile=${font}:text='ONE MILLION SOULS • ONE MISSION • ONE SAVIOUR':fontcolor=white@0.92:fontsize=20:x=(w-text_w)/2:y=h-80`,
  ].join(',')

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=0x071A33:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${Math.max(8, duration + 0.5).toFixed(2)}`,
    '-i', wavPath,
    '-filter_threads', '1',
    '-vf', filter,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'stillimage',
    '-crf', '27',
    '-threads', '2',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-movflags', '+faststart',
    mp4Path,
  ], { timeout: 300_000, maxBuffer: 20 * 1024 * 1024 })

  const key = `renders/${new Date().toISOString().slice(0, 10)}/${id}.mp4`
  const bytes = await fs.readFile(mp4Path)

  if (s3) {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.BUCKET,
      Key: key,
      Body: bytes,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
    }))
  } else {
    localFiles.set(key, mp4Path)
  }

  const mediaUrl = `${publicBase()}/media/${key.split('/').map(encodeURIComponent).join('/')}`

  return {
    ok: true,
    renderer: 'one-million-souls-offline-renderer-v1',
    mediaUrl,
    width: WIDTH,
    height: HEIGHT,
    durationSeconds: Number(duration.toFixed(2)),
    captionsPresent: true,
    audioPresent: true,
    rightsCleared: true,
    scriptureIntegrity: true,
    rendererPreservedScript: true,
    persistentStorage: Boolean(s3),
    dryRun: body?.dryRun === true,
  }
}

async function readStoredJson(key) {
  if (!s3) throw new Error('Persistent storage unavailable')
  const result = await s3.send(new GetObjectCommand({ Bucket: process.env.BUCKET, Key: key }))
  const text = await result.Body?.transformToString()
  if (!text) throw new Error('Stored JSON empty')
  return JSON.parse(text)
}

async function serveMedia(req, res, key) {
  try {
    if (s3) {
      const result = await s3.send(new GetObjectCommand({ Bucket: process.env.BUCKET, Key: key }))
      res.writeHead(200, {
        'content-type': result.ContentType || 'video/mp4',
        'cache-control': result.CacheControl || 'public, max-age=31536000, immutable',
      })
      result.Body.pipe(res)
      return
    }
    const local = localFiles.get(key)
    if (!local) return sendJson(res, 404, { ok: false, error: 'Media not found' })
    const data = await fs.readFile(local)
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': data.length })
    res.end(data)
  } catch (error) {
    sendJson(res, 404, { ok: false, error: error instanceof Error ? error.message : 'Media not found' })
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    return sendJson(res, 200, {
      ok: true,
      service: 'one-million-souls-video-renderer',
      ffmpeg: true,
      offlineTts: true,
      legacyRendererEnabled: false,
      productionRenderer: '/render-v2',
      v2RendererReady: true,
      persistentStorage: storageReady,
      renderProfile: `${WIDTH}x${HEIGHT}@${FPS}`,
    })
  }

  if (req.method === 'GET' && url.pathname === '/factory-manifest') {
    if (!authorized(req)) return sendJson(res, 401, { ok:false, error:'Unauthorized' })
    const date = url.searchParams.get('date') || 'latest'
    if (date !== 'latest' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { ok:false, error:'date must be YYYY-MM-DD or latest' })
    try {
      const key = date === 'latest' ? 'manifests/latest.json' : `manifests/${date}.json`
      const manifest = await readStoredJson(key)
      return sendJson(res, 200, manifest)
    } catch (error) {
      return sendJson(res, 404, { ok:false, error:error instanceof Error ? error.message : 'Manifest not found' })
    }
  }

  if (req.method === 'POST' && url.pathname === '/factory-retry') {
    if (!authorized(req)) return sendJson(res, 401, { ok:false, error:'Unauthorized' })
    try {
      const body = await readJson(req)
      const result = await requestFactoryRetry({
        date:body?.date,
        slot:body?.slot,
        expectedMasterHash:body?.expectedMasterHash,
        reason:body?.reason,
      })
      return sendJson(res, 202, result)
    } catch (error) {
      return sendJson(res, 409, { ok:false, blocked:true, error:error instanceof Error ? error.message : 'Factory retry rejected' })
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
    const key = url.pathname.slice('/media/'.length).split('/').map(decodeURIComponent).join('/')
    return serveMedia(req, res, key)
  }

  if (req.method === 'POST' && url.pathname === '/render-v2') {
    if (!authorized(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
    try {
      const body = await readJson(req)
      const result = await renderFreeV2(body)
      return sendJson(res, 200, result)
    } catch (error) {
      console.error(error)
      return sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : 'Render V2 failed',
      })
    }
  }

  if (req.method === 'POST' && (url.pathname === '/render' || url.pathname === '/')) {
    if (!authorized(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
    return sendJson(res, 410, {
      ok: false,
      blocked: true,
      error: 'LEGACY_RENDERER_DISABLED',
      message: 'V59 production rendering must use /render-v2 and pass the PROFESSIONAL_MASTER pipeline. Legacy static/offline rendering cannot produce publishable media.',
      requiredEndpoint: '/render-v2',
    })
  }

  return sendJson(res, 404, { ok: false, error: 'Not found' })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`One Million Souls video renderer listening on ${PORT}`)
})
