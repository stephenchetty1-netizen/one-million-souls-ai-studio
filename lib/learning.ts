export type PerformanceRecord = {
  id: string
  platform: 'tiktok' | 'youtube'
  publishedAt: string
  title: string
  hook?: string
  topic?: string
  pillar?: string
  views: number
  likes: number
  comments: number
  shares: number
  follows: number
  avgWatchSeconds?: number
  avgPercentageViewed?: number
  choseToViewRate?: number
  url?: string
  experimentId?: string
  variantId?: string
}

export type GrowthStrategy = {
  generatedAt: string
  summary: string
  winningTopics: string[]
  winningHooks: string[]
  winningFormats: string[]
  experiments: string[]
  nextTopics: string[]
  guardrails: string[]
}

const memory: { records: PerformanceRecord[]; strategy?: GrowthStrategy } = { records: [] }

function redisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  }
}

async function redis(command: string[]) {
  const { url, token } = redisConfig()
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Learning store failed (${response.status}).`)
  return response.json()
}

export async function savePerformance(record: PerformanceRecord) {
  memory.records = [record, ...memory.records.filter(x => x.id !== record.id)].slice(0, 500)
  const key = `one-million-souls:performance:${record.id}`
  await redis(['set', key, JSON.stringify(record)])
  await redis(['lpush', 'one-million-souls:performance:index', record.id])
  await redis(['ltrim', 'one-million-souls:performance:index', '0', '499'])
}

export async function getPerformance(limit = 100): Promise<PerformanceRecord[]> {
  const idsResult = await redis(['lrange', 'one-million-souls:performance:index', '0', String(Math.max(0, limit - 1))])
  if (!idsResult?.result?.length) return memory.records.slice(0, limit)
  const ids = idsResult.result as string[]
  const records: PerformanceRecord[] = []
  for (const id of ids) {
    const result = await redis(['get', `one-million-souls:performance:${id}`])
    if (result?.result) {
      try { records.push(JSON.parse(result.result)) } catch {}
    }
  }
  return records.length ? records : memory.records.slice(0, limit)
}

export async function saveStrategy(strategy: GrowthStrategy) {
  memory.strategy = strategy
  await redis(['set', 'one-million-souls:growth-strategy', JSON.stringify(strategy)])
}

export async function getStrategy(): Promise<GrowthStrategy | null> {
  const result = await redis(['get', 'one-million-souls:growth-strategy'])
  if (result?.result) {
    try { return JSON.parse(result.result) } catch {}
  }
  return memory.strategy ?? null
}

export function summarize(records: PerformanceRecord[]) {
  if (!records.length) return { totalPosts: 0, avgViews: 0, engagementRate: 0, followRate: 0, retention: 0 }
  const sum = (key: keyof PerformanceRecord) => records.reduce((n, r) => n + Number(r[key] || 0), 0)
  const views = sum('views')
  return {
    totalPosts: records.length,
    avgViews: Math.round(views / records.length),
    engagementRate: views ? Number(((sum('likes') + sum('comments') + sum('shares')) / views * 100).toFixed(2)) : 0,
    followRate: views ? Number((sum('follows') / views * 100).toFixed(3)) : 0,
    retention: Number((records.reduce((n, r) => n + Number(r.avgPercentageViewed || 0), 0) / records.length).toFixed(1)),
  }
}

export function normalizePerformance(input: unknown): PerformanceRecord {
  const value = input as Record<string, unknown>
  const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0
  const platform = value.platform === 'youtube' ? 'youtube' : 'tiktok'
  return {
    id: String(value.id || `${platform}:${value.url || value.publishedAt || Date.now()}`),
    platform,
    publishedAt: String(value.publishedAt || new Date().toISOString()),
    title: String(value.title || 'Untitled post'),
    hook: value.hook ? String(value.hook) : undefined,
    topic: value.topic ? String(value.topic) : undefined,
    pillar: value.pillar ? String(value.pillar) : undefined,
    views: Math.max(0, num(value.views)),
    likes: Math.max(0, num(value.likes)),
    comments: Math.max(0, num(value.comments)),
    shares: Math.max(0, num(value.shares)),
    follows: Math.max(0, num(value.follows)),
    avgWatchSeconds: value.avgWatchSeconds == null ? undefined : Math.max(0, num(value.avgWatchSeconds)),
    avgPercentageViewed: value.avgPercentageViewed == null ? undefined : Math.min(100, Math.max(0, num(value.avgPercentageViewed))),
    choseToViewRate: value.choseToViewRate == null ? undefined : Math.min(100, Math.max(0, num(value.choseToViewRate))),
    url: value.url ? String(value.url) : undefined,
    experimentId: value.experimentId ? String(value.experimentId) : undefined,
    variantId: value.variantId ? String(value.variantId) : undefined,
  }
}
