import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync=promisify(execFile)
const storageReady = Boolean(process.env.ENDPOINT && process.env.BUCKET && process.env.REGION && process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY)
const s3 = storageReady ? new S3Client({
  endpoint: process.env.ENDPOINT, region: process.env.REGION, forcePathStyle: true,
  credentials: { accessKeyId: process.env.ACCESS_KEY_ID, secretAccessKey: process.env.SECRET_ACCESS_KEY },
}) : null
const musicSourceLocks = new Map()
const MUSIC_CACHE_PREFIX = 'music-source-cache/v1'
const MUSIC_CACHE_DIR = path.join(os.tmpdir(), 'one-million-souls-rights-cleared-music')

const TRACKS=[
  {
    id:'above-the-clouds',
    sourcePage:'https://commons.wikimedia.org/wiki/File:John_Bartmann_-_above-the-clouds-master.ogg',
    fileUrl:'https://commons.wikimedia.org/wiki/Special:Redirect/file/John_Bartmann_-_above-the-clouds-master.ogg',
    license:'CC0-1.0',
    rightsNote:'Copyright holder dedicated the recording to the public domain under CC0 1.0 as documented by Wikimedia Commons.',
  },
  {
    id:'foggy-trees',
    sourcePage:'https://commons.wikimedia.org/wiki/File:John_Bartmann_-_foggy-trees-master.ogg',
    fileUrl:'https://commons.wikimedia.org/wiki/Special:Redirect/file/John_Bartmann_-_foggy-trees-master.ogg',
    license:'CC0-1.0',
    rightsNote:'Copyright holder dedicated the recording to the public domain under CC0 1.0 as documented by Wikimedia Commons.',
  },
  {
    id:'cendence',
    sourcePage:'https://commons.wikimedia.org/wiki/File:John_Bartmann_-_cendence-master.ogg',
    fileUrl:'https://commons.wikimedia.org/wiki/Special:Redirect/file/John_Bartmann_-_cendence-master.ogg',
    license:'CC0-1.0',
    rightsNote:'Copyright holder dedicated the recording to the public domain under CC0 1.0 as documented by Wikimedia Commons.',
  },
]

async function download(url,file){
  let lastStatus=0
  for(let attempt=0;attempt<4;attempt++){
    const r=await fetch(url,{redirect:'follow',headers:{'user-agent':'OneMillionSoulsRenderer/1.1 (automated devotional media renderer; respectful caching and backoff)'}})
    lastStatus=r.status
    if(r.ok){
      const bytes=Buffer.from(await r.arrayBuffer())
      if(bytes.length<100000)throw new Error('stock music download too small')
      await fs.writeFile(file,bytes)
      return
    }
    if(r.status!==429 && r.status<500) break
    const retryAfter=Number(r.headers.get('retry-after')||0)
    const waitMs=Math.max(retryAfter*1000,Math.min(30000,1000*(2**attempt)))
    await new Promise(resolve=>setTimeout(resolve,waitMs))
  }
  throw new Error(`stock music download failed ${lastStatus}`)
}

async function ensureCachedMusic(track) {
  await fs.mkdir(MUSIC_CACHE_DIR, { recursive: true })
  const cached = path.join(MUSIC_CACHE_DIR, `${track.id}.ogg`)
  const isValid = async () => {
    try { return (await fs.stat(cached)).size >= 100000 } catch { return false }
  }
  if (await isValid()) return cached
  if (musicSourceLocks.has(track.id)) {
    await musicSourceLocks.get(track.id)
    return cached
  }
  const task = (async () => {
    const key = `${MUSIC_CACHE_PREFIX}/${track.id}.ogg`
    if (s3) {
      try {
        const object = await s3.send(new GetObjectCommand({ Bucket: process.env.BUCKET, Key: key }))
        const bytes = Buffer.from(await object.Body.transformToByteArray())
        if (bytes.length >= 100000) {
          await fs.writeFile(cached, bytes)
          console.log('STOCK_MUSIC_CACHE_RESTORE', JSON.stringify({ trackId: track.id }))
          return
        }
      } catch { /* Cache miss: download the original CC0 source. */ }
    }
    const incoming = `${cached}.part-${process.pid}`
    try {
      await download(track.fileUrl, incoming)
      await fs.rename(incoming, cached)
    } finally {
      await fs.rm(incoming, { force: true }).catch(() => {})
    }
    if (s3) {
      try {
        await s3.send(new PutObjectCommand({
          Bucket: process.env.BUCKET, Key: key, Body: await fs.readFile(cached),
          ContentType: 'audio/ogg', CacheControl: 'private, max-age=31536000, immutable',
        }))
        console.log('STOCK_MUSIC_CACHE_STORE', JSON.stringify({ trackId: track.id }))
      } catch (error) {
        console.warn('STOCK_MUSIC_CACHE_STORE_FAILED', JSON.stringify({
          trackId: track.id, error: error instanceof Error ? error.message : String(error),
        }))
      }
    }
  })()
  musicSourceLocks.set(track.id, task)
  try { await task; return cached }
  finally { musicSourceLocks.delete(track.id) }
}

export async function createRightsClearedStockMusic(duration,work,seed=0){
  const track=TRACKS[Math.abs(Number(seed)||0)%TRACKS.length]
  const source=path.join(work,`${track.id}.ogg`)
  const out=path.join(work,'music-stock.m4a')
  const cached = await ensureCachedMusic(track)
  await fs.copyFile(cached, source)
  const seconds=Math.max(10,Math.min(60,Math.ceil(duration)+2))
  const start=Math.abs(Number(seed)||0)%90
  await execFileAsync('ffmpeg',[
    '-y','-ss',String(start),'-i',source,'-t',String(seconds),
    '-af',`afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(1,seconds-1.5)}:d=1.5`,
    '-c:a','aac','-b:a','160k',out
  ],{timeout:120000,maxBuffer:10*1024*1024})
  const stat=await fs.stat(out)
  if(stat.size<50000)throw new Error('stock music render invalid')
  return {
    url:track.fileUrl,
    local:out,
    provider:'rights-cleared-stock-music',
    rights:{trackId:track.id,sourcePage:track.sourcePage,license:track.license,rightsNote:track.rightsNote},
  }
}
