async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Job store failed (${response.status}).`)
  return response.json()
}

/** Claim a scheduled job once. Redis-backed in production; fail closed when persistence is unavailable. */
export async function claimJob(jobId: string, ttlSeconds = 900) {
  const doneKey = `one-million-souls:job:done:${jobId}`
  const lockKey = `one-million-souls:job:lock:${jobId}`
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Persistent job storage is required for autonomous publishing. Configure Upstash Redis before enabling autopilot.')
  }
  const done = await redis(['get', doneKey])
  if (done?.result) return false
  const lock = await redis(['set', lockKey, '1', 'NX', 'EX', String(ttlSeconds)])
  return lock?.result === 'OK'
}

export async function completeJob(jobId: string, value: unknown = { ok: true }) {
  await redis(['set', `one-million-souls:job:done:${jobId}`, JSON.stringify(value)])
  await redis(['del', `one-million-souls:job:lock:${jobId}`])
}

export async function releaseJob(jobId: string) {
  await redis(['del', `one-million-souls:job:lock:${jobId}`])
}

export async function redisSetJson(key: string, value: unknown, ttlSeconds?: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Persistent store is required.')
  const encoded = encodeURIComponent(JSON.stringify(value))
  const endpoint = ttlSeconds ? `${url}/set/${encodeURIComponent(key)}/${encoded}/EX/${ttlSeconds}` : `${url}/set/${encodeURIComponent(key)}/${encoded}`
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`Redis SET failed: ${response.status}`)
  return response.json()
}

export async function redisGetJson<T = unknown>(key: string): Promise<T | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`Redis GET failed: ${response.status}`)
  const data = await response.json() as { result?: string | null }
  return data.result ? JSON.parse(data.result) as T : null
}
