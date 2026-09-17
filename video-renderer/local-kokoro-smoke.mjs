import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { KokoroTTS } from 'kokoro-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const enabled = process.env.LOCAL_KOKORO_SMOKE_ENABLED === 'true'

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

async function upload(file, voice) {
  if (!s3) throw new Error('Persistent storage is required')
  const key = `voice-tests/${new Date().toISOString().slice(0, 10)}/${voice}-${crypto.randomUUID()}.wav`
  const bytes = await fs.readFile(file)
  await s3.send(new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: key,
    Body: bytes,
    ContentType: 'audio/wav',
    CacheControl: 'public, max-age=86400',
  }))
  return `${publicBase()}/media/${key.split('/').map(encodeURIComponent).join('/')}`
}

async function run() {
  const startedAt = Date.now()
  const modelId = process.env.LOCAL_KOKORO_MODEL || 'onnx-community/Kokoro-82M-v1.0-ONNX'
  console.log('LOCAL_KOKORO_LOADING', JSON.stringify({ modelId, dtype: 'q8', device: 'cpu' }))

  const tts = await KokoroTTS.from_pretrained(modelId, {
    dtype: 'q8',
    device: 'cpu',
  })

  const text = 'Fear may be loud, but God is with you. Choose faith over fear today. Keep praying, keep trusting, and keep your eyes on Jesus. Your story is not finished.'
  const voices = (process.env.LOCAL_KOKORO_TEST_VOICES || 'af_heart,bm_george')
    .split(',').map((value) => value.trim()).filter(Boolean).slice(0, 2)

  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'kokoro-local-'))
  const results = []

  for (const voice of voices) {
    const output = await tts.generate(text, { voice })
    const file = path.join(work, `${voice}.wav`)
    await output.save(file)
    const stat = await fs.stat(file)
    if (stat.size < 1000) throw new Error(`Local Kokoro produced an invalid WAV for ${voice}`)
    const mediaUrl = await upload(file, voice)
    results.push({ voice, bytes: stat.size, mediaUrl })
  }

  console.log('LOCAL_KOKORO_RESULT', JSON.stringify({
    ok: true,
    modelId,
    paidGenerationCreditsUsed: false,
    elapsedMs: Date.now() - startedAt,
    results,
  }))
}

if (enabled) {
  setTimeout(() => run().catch((error) => {
    console.error('LOCAL_KOKORO_FAILED', error instanceof Error ? error.message : String(error))
  }), 4000)
}
