const port = Number(process.env.PORT || 8080)
const base = `http://127.0.0.1:${port}`
const secret = process.env.VIDEO_RENDER_SECRET || ''

const payload = {
  title: 'GOD HAS A PLAN FOR YOU',
  script: "God is not finished with you. Even when you cannot see the way ahead, keep trusting Jesus, keep praying, and keep moving forward in faith. Jeremiah 29:11 reminds us that God knows the plans He has for His people. Your story is not over.",
}

const headers = { 'content-type': 'application/json' }
if (secret) headers.authorization = `Bearer ${secret}`

const response = await fetch(`${base}/render`, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
})

const result = await response.json().catch(() => ({}))
if (!response.ok || !result?.ok || !result?.mediaUrl) {
  console.error('SMOKE_TEST_FAILED', response.status, JSON.stringify(result))
  process.exit(1)
}

const mediaPath = new URL(result.mediaUrl).pathname
const mediaResponse = await fetch(`${base}${mediaPath}`)
const bytes = Buffer.from(await mediaResponse.arrayBuffer())
const hasFtyp = bytes.subarray(0, Math.min(bytes.length, 128)).includes(Buffer.from('ftyp'))

if (!mediaResponse.ok || bytes.length < 10_000 || !hasFtyp) {
  console.error('SMOKE_TEST_MEDIA_FAILED', mediaResponse.status, bytes.length, hasFtyp)
  process.exit(1)
}

console.log('SMOKE_TEST_SUCCESS', JSON.stringify({
  mediaUrl: result.mediaUrl,
  bytes: bytes.length,
  width: result.width,
  height: result.height,
  durationSeconds: result.durationSeconds,
  captionsPresent: result.captionsPresent,
  audioPresent: result.audioPresent,
  persistentStorage: result.persistentStorage,
}))
