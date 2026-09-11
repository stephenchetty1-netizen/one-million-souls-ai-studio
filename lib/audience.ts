export type AudienceSignalCategory = 'question' | 'prayer_request' | 'testimony' | 'encouragement' | 'objection' | 'topic_request'

export type AudienceSignal = {
  id: string
  platform: 'tiktok' | 'youtube'
  postId?: string
  text: string
  createdAt: string
  category: AudienceSignalCategory
  topic?: string
  scripture?: string
  engagementCount?: number
}

export type AudienceProfile = {
  generatedAt: string
  topNeeds: string[]
  recurringQuestions: string[]
  prayerThemes: string[]
  objections: string[]
  topicDemand: string[]
  audienceLanguage: string[]
  recommendedAngles: string[]
  guardrails: string[]
}

const memory: { signals: AudienceSignal[]; profile?: AudienceProfile } = { signals: [] }

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Audience store failed (${response.status}).`)
  return response.json()
}

export async function saveAudienceSignal(signal: AudienceSignal) {
  memory.signals = [signal, ...memory.signals.filter(x => x.id !== signal.id)].slice(0, 1000)
  await redis(['set', `one-million-souls:audience:signal:${signal.id}`, JSON.stringify(signal)])
  await redis(['lpush', 'one-million-souls:audience:signal:index', signal.id])
  await redis(['ltrim', 'one-million-souls:audience:signal:index', '0', '999'])
}

export async function getAudienceSignals(limit = 300): Promise<AudienceSignal[]> {
  const idsResult = await redis(['lrange', 'one-million-souls:audience:signal:index', '0', String(Math.max(0, limit - 1))])
  if (!idsResult?.result?.length) return memory.signals.slice(0, limit)
  const signals: AudienceSignal[] = []
  for (const id of idsResult.result as string[]) {
    const result = await redis(['get', `one-million-souls:audience:signal:${id}`])
    if (result?.result) { try { signals.push(JSON.parse(result.result)) } catch {} }
  }
  return signals.length ? signals : memory.signals.slice(0, limit)
}

export async function saveAudienceProfile(profile: AudienceProfile) {
  memory.profile = profile
  await redis(['set', 'one-million-souls:audience:profile', JSON.stringify(profile)])
}

export async function getAudienceProfile(): Promise<AudienceProfile | null> {
  const result = await redis(['get', 'one-million-souls:audience:profile'])
  if (result?.result) { try { return JSON.parse(result.result) } catch {} }
  return memory.profile ?? null
}

export function normalizeAudienceSignal(input: unknown): AudienceSignal {
  const value = input as Record<string, unknown>
  const categories: AudienceSignalCategory[] = ['question','prayer_request','testimony','encouragement','objection','topic_request']
  const category = categories.includes(value.category as AudienceSignalCategory) ? value.category as AudienceSignalCategory : 'question'
  return {
    id: String(value.id || `${value.platform || 'tiktok'}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`),
    platform: value.platform === 'youtube' ? 'youtube' : 'tiktok',
    postId: value.postId ? String(value.postId) : undefined,
    text: String(value.text || '').trim().slice(0, 2000),
    createdAt: String(value.createdAt || new Date().toISOString()),
    category,
    topic: value.topic ? String(value.topic).slice(0, 300) : undefined,
    scripture: value.scripture ? String(value.scripture).slice(0, 200) : undefined,
    engagementCount: Number.isFinite(Number(value.engagementCount)) ? Math.max(0, Number(value.engagementCount)) : 0,
  }
}
