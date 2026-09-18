import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const WIDTH = Number(process.env.RENDER_WIDTH || 1080)
const HEIGHT = Number(process.env.RENDER_HEIGHT || 1920)
const FPS = Number(process.env.RENDER_FPS || 30)

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
    url:'https://upload.wikimedia.org/wikipedia/commons/0/05/Sunrise_on_a_Large_Spring_Storm_%28CIRA_2026-04-02_-_nolabels_portrait%29.webm',
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
    id:'sunrise-yoga',
    url:'https://upload.wikimedia.org/wikipedia/commons/3/3b/Sunrise_Yoga_%281021677%29.webm',
    sourcePage:'https://commons.wikimedia.org/wiki/File:Sunrise_Yoga_(1021677).webm',
    license:'Public-Domain-US-Navy',
    rightsNote:'U.S. Navy work created as part of official duties; public domain as documented by Wikimedia Commons.',
  },
])

async function download(url, target) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect:'follow' })
    if (!response.ok) throw new Error(`stock download failed ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length < 10000) throw new Error('stock download returned invalid media')
    await fs.writeFile(target, bytes)
  } finally {
    clearTimeout(timer)
  }
}

export async function createRightsClearedStockScene(index, work, seconds = 5, seed = 0) {
  const item = STOCK_VIDEO_LIBRARY[(Math.abs(seed) + index * 5) % STOCK_VIDEO_LIBRARY.length]
  const input = path.join(work, `stock-${index + 1}.webm`)
  const output = path.join(work, `stock-scene-${index + 1}.mp4`)
  await download(item.url, input)

  await execFileAsync('ffmpeg', [
    '-y',
    '-stream_loop','-1',
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
    sourceUrl:item.url,
    sourcePage:item.sourcePage,
    license:item.license,
    rightsNote:item.rightsNote,
  }
}
