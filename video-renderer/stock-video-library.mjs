import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const execFileAsync = promisify(execFile)
const WIDTH = Number(process.env.RENDER_WIDTH || 1080)
const HEIGHT = Number(process.env.RENDER_HEIGHT || 1920)
const FPS = Number(process.env.RENDER_FPS || 30)
const STOCK_CACHE_DIR = process.env.STOCK_CACHE_DIR || '/tmp/one-million-souls-stock-cache'
const downloadLocks = new Map()
const storageReady = Boolean(
  process.env.ENDPOINT && process.env.BUCKET && process.env.REGION &&
  process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY
)
const s3 = storageReady ? new S3Client({
  endpoint:process.env.ENDPOINT,
  region:process.env.REGION,
  forcePathStyle:true,
  credentials:{
    accessKeyId:process.env.ACCESS_KEY_ID,
    secretAccessKey:process.env.SECRET_ACCESS_KEY,
  },
}) : null
const STOCK_CACHE_PREFIX = 'stock-source-cache/v1'

const QUARANTINED_STOCK_IDS = new Set(['sunrise-yoga','flight-over-clouds','sunrise-yoga-broll','sunrise-yoga-no-template'])

export const STOCK_VIDEO_LIBRARY = Object.freeze([
  {
    id:'dragon-boat-sunrise',
    url:'https://upload.wikimedia.org/wikipedia/commons/9/97/Dragon_boat_training_session_at_sunrise_on_a_cloudy_morning.webm',
    sourcePage:'https://commons.wikimedia.org/wiki/File:Dragon_boat_training_session_at_sunrise_on_a_cloudy_morning.webm',
    license:'CC0-1.0',
    rightsNote:'Copyright holder dedicated the work to the public domain under CC0 1.0.',
  },
  {
    id:'flight-over-clouds',
    url:'https://upload.wikimedia.org/wikipedia/commons/2/2d/Flight_over_clouds.webm',
    sourcePage:'https://commons.wikimedia.org/wiki/File:Flight_over_clouds.webm',
    license:'CC0-1.0',
    rightsNote:'Copyright holder dedicated the work to the public domain under CC0 1.0.',
  },
  {
    id:'sunrise-storm-portrait',
    url:'https://satlib.cira.colostate.edu/wp-content/uploads/sites/23/2026/04/20260402120117-20260402144617_g19_abi_conus_geocolor_the-sun-rises-on-early-April-storm_nolabels_portrait.mp4',
    sourcePage:'https://commons.wikimedia.org/wiki/File:Sunrise_on_a_Large_Spring_Storm_(CIRA_2026-04-02_-_nolabels_portrait).webm',
    license:'Public-Domain-US-NOAA',
    rightsNote:'U.S. NOAA federal-government material; public domain as documented by Wikimedia Commons.',
  },
  {
    id:'domica-cave',
    url:'https://upload.wikimedia.org/wikipedia/commons/d/d2/Domica_Cave.webm',
    sourcePage:'https://commons.wikimedia.org/wiki/File:Domica_Cave.webm',
    license:'CC0-1.0',
    rightsNote:'Copyright holder dedicated the work to the public domain under CC0 1.0.',
  },
  {
    id:'hornbill-morning',
    url:'https://upload.wikimedia.org/wikipedia/commons/b/b4/Hornbill.webm',
    sourcePage:'https://commons.wikimedia.org/wiki/File:Hornbill.webm',
    license:'CC0-1.0',
    rightsNote:'Copyright holder dedicated the work to the public domain under CC0 1.0.',
  },
  {
    id:'sunrise-yoga-broll',
    url:'https://d34w7g4gy10iej.cloudfront.net/video/2609/DOD_111960718/DOD_111960718.mp4',
    sourcePage:'https://commons.wikimedia.org/wiki/File:Sunrise_Yoga_B-Roll_(1022214).webm',
    license:'Public-Domain-US-Navy',
    rightsNote:'U.S. Navy work created as part of official duties; public domain as documented by Wikimedia Commons.',
  },
  {
    id:'sunrise-yoga-no-template',
    url:'https://d34w7g4gy10iej.cloudfront.net/video/2609/DOD_111960716/DOD_111960716.mp4',
    sourcePage:'https://commons.wikimedia.org/wiki/File:260902-SDB-SunriseYoga_No_Template_(1022213).webm',
    license:'Public-Domain-US-Navy',
    rightsNote:'U.S. Navy work created as part of official duties; public domain as documented by Wikimedia Commons.',
  },
  {
    id:'sunrise-yoga',
    url:'https://d34w7g4gy10iej.cloudfront.net/video/2609/DOD_111947415/DOD_111947415-1920x1080-9000k.mp4',
    sourcePage:'https://commons.wikimedia.org/wiki/File:Sunrise_Yoga_(1021677).webm',
    license:'Public-Domain-US-Navy',
    rightsNote:'U.S. Navy work created as part of official duties; public domain as documented by Wikimedia Commons.',
  },
])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function downloadWithRetry(url, target) {
  let lastError
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120000)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect:'follow',
        headers: {
          'user-agent':'OneMillionSoulsV59/1.0 (rights-cleared media fetch)',
          'accept':'video/webm,video/mp4,application/octet-stream;q=0.9,*/*;q=0.1',
        },
      })
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500
        if (!retryable) throw new Error(`stock download failed ${response.status}`)
        throw new Error(`stock download retryable ${response.status}`)
      }
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length < 10000) throw new Error('stock download returned invalid media')
      const temp = `${target}.part-${process.pid}-${Date.now()}`
      await fs.writeFile(temp, bytes)
      await fs.rename(temp, target)
      return
    } catch (error) {
      lastError = error
      if (attempt < 4) await sleep(2500 * attempt)
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError || new Error('stock download failed')
}

async function restoreFromPersistentCache(item, cached, ext) {
  if (!s3) return false
  const key = `${STOCK_CACHE_PREFIX}/${item.id}${ext}`
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket:process.env.BUCKET, Key:key }))
    const bytes = Buffer.from(await result.Body.transformToByteArray())
    if (bytes.length < 10000) return false
    await fs.writeFile(cached, bytes)
    return true
  } catch {
    return false
  }
}

async function persistSourceCache(item, cached, ext) {
  if (!s3) return
  const key = `${STOCK_CACHE_PREFIX}/${item.id}${ext}`
  const bytes = await fs.readFile(cached)
  await s3.send(new PutObjectCommand({
    Bucket:process.env.BUCKET,
    Key:key,
    Body:bytes,
    ContentType: ext === '.mp4' ? 'video/mp4' : 'video/webm',
    CacheControl:'private, max-age=31536000, immutable',
  }))
}

async function ensureCached(item) {
  await fs.mkdir(STOCK_CACHE_DIR, { recursive:true })
  const ext = item.url.toLowerCase().includes('.mp4') ? '.mp4' : '.webm'
  const cached = path.join(STOCK_CACHE_DIR, `${item.id}${ext}`)
  try {
    const stat = await fs.stat(cached)
    if (stat.size >= 10000) return cached
  } catch {}

  if (downloadLocks.has(item.id)) {
    await downloadLocks.get(item.id)
    return cached
  }

  const task = (async () => {
    if (await restoreFromPersistentCache(item, cached, ext)) {
      console.log('STOCK_SOURCE_CACHE_RESTORE', JSON.stringify({ stockId:item.id }))
      return
    }
    await sleep(900)
    await downloadWithRetry(item.url, cached)
    await persistSourceCache(item, cached, ext)
    console.log('STOCK_SOURCE_CACHE_STORE', JSON.stringify({ stockId:item.id }))
  })()
  downloadLocks.set(item.id, task)
  try {
    await task
    return cached
  } finally {
    downloadLocks.delete(item.id)
  }
}

export async function createRightsClearedStockScene(index, work, seconds = 5, seed = 0, selection = null) {
  // No arbitrary index/seed fallback: a video editor must supply an explicit
  // Scripture/story-beat stock shot, or production fails closed.
  if(!selection?.stockId || !selection?.meaning || !selection?.stage)
    throw new Error('STOCK_SCENE_REQUIRES_CURATED_STORY_BEAT')
  const item=STOCK_VIDEO_LIBRARY.find((stock)=>stock.id===selection.stockId)
  if(!item)throw new Error('CURATED_STOCK_ASSET_NOT_FOUND:'+selection.stockId)
  if(QUARANTINED_STOCK_IDS.has(item.id))
    throw new Error(`Quarantined stock media selected: ${item.id}`)
  const startSeconds=Number(selection.startSeconds||0)
  if(!Number.isFinite(startSeconds)||startSeconds<0||startSeconds>300)
    throw new Error('INVALID_CURATED_STOCK_TRIM')
  const input = await ensureCached(item)
  const output = path.join(work, `stock-scene-${index + 1}.mp4`)

  await execFileAsync('ffmpeg', [
    '-y',
    '-stream_loop','-1',
    '-ss', String(startSeconds),
    '-i', input,
    '-t', String(seconds),
    '-an',
    '-filter_threads','1',
    '-vf', `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},fps=${FPS},eq=contrast=1.035:saturation=1.04:gamma=1.01`,
    '-c:v','libx264',
    '-preset','veryfast',
    '-crf','19',
    '-threads','2',
    '-pix_fmt','yuv420p',
    '-movflags','+faststart',
    output,
  ], { timeout: 180000, maxBuffer: 8 * 1024 * 1024 })

  const stat = await fs.stat(output)
  if (stat.size < 10000) throw new Error('rights-cleared stock scene produced invalid MP4')

  return {
    local: output,
    source:'rights-cleared-stock-video',
    stockId:item.id,
    startSeconds,
    beatStage:selection.stage,
    storyboardVersion:selection.storyboardVersion,
    visualMeaning:selection.meaning,
    repriseOf:selection.repriseOf,
    sourceUrl:item.url,
    sourcePage:item.sourcePage,
    license:item.license,
    rightsNote:item.rightsNote,
  }
}
