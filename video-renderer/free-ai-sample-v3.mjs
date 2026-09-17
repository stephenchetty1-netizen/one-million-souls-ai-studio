import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { renderFreeV2 } from './free-ai-render-v2.mjs'

const enabled = process.env.FREE_AI_V3_SAMPLE_ENABLED === 'true'
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

async function claimSample(key) {
  if (!s3) return true
  const objectKey = `sample-locks/${key}.json`
  try {
    await s3.send(new HeadObjectCommand({ Bucket: process.env.BUCKET, Key: objectKey }))
    return false
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode
    if (status && status !== 404) throw error
  }
  await s3.send(new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: objectKey,
    Body: JSON.stringify({ key, claimedAt: new Date().toISOString() }),
    ContentType: 'application/json',
    CacheControl: 'no-store',
  }))
  return true
}

if (enabled) {
  const body = {
    title: 'FAITH OVER FEAR',
    script: `Fear may be loud, but God is with you, Isaiah 41:10 reminds us to fear not because He is with us, so keep praying, keep trusting, keep moving forward, choose faith over fear today, fix your eyes on Jesus, take the next faithful step, and remember that this difficult season is not the end of your story.`,
  }

  const sampleKey = process.env.FREE_AI_V3_SAMPLE_KEY || 'manual-v3'
  console.log('FREE_AI_V3_SAMPLE_ARMED', JSON.stringify({ sampleKey }))
  setTimeout(async () => {
    try {
      const claimed = await claimSample(sampleKey)
      if (!claimed) {
        console.log('FREE_AI_V3_SAMPLE_SKIPPED_DUPLICATE', JSON.stringify({ sampleKey }))
        return
      }
      console.log('FREE_AI_V3_SAMPLE_START', JSON.stringify({ sampleKey }))
      const result = await renderFreeV2(body)
      console.log('FREE_AI_V3_SAMPLE_RESULT', JSON.stringify({ sampleKey, ...result }))
    } catch (error) {
      console.error('FREE_AI_V3_SAMPLE_FAILED', error instanceof Error ? error.message : String(error))
    }
  }, 6000)
}
