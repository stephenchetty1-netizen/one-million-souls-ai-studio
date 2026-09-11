import { getPerformance, type PerformanceRecord } from './learning'

export type ExperimentVariant = {
  id: string
  label: string
  hook: string
  opening: string
  angle: string
}

export type ContentExperiment = {
  id: string
  createdAt: string
  hypothesis: string
  baseTopic: string
  metric: 'views' | 'retention' | 'engagement' | 'follows'
  variants: ExperimentVariant[]
  winnerId?: string
  status: 'PLANNED' | 'RUNNING' | 'COMPLETED'
}

const memory: ContentExperiment[] = []
const key = 'one-million-souls:experiments'

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Experiment store failed (${response.status}).`)
  return response.json()
}

export async function getExperiments(limit = 20): Promise<ContentExperiment[]> {
  const result = await redis(['lrange', key, '0', String(Math.max(0, limit - 1))])
  if (result?.result?.length) {
    return (result.result as string[]).map(x => { try { return JSON.parse(x) } catch { return null } }).filter(Boolean)
  }
  return memory.slice(0, limit)
}

export async function saveExperiment(experiment: ContentExperiment) {
  const existing = memory.findIndex(x => x.id === experiment.id)
  if (existing >= 0) memory[existing] = experiment
  else memory.unshift(experiment)
  const payload = JSON.stringify(experiment)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    await redis(['lrem', key, '0', payload])
    await redis(['lpush', key, payload])
    await redis(['ltrim', key, '0', '99'])
  }
  return experiment
}

export function buildExperiment(topic: string, learnedHooks: string[] = []): ContentExperiment {
  const hook = learnedHooks[0] || 'If you feel like God is silent, don’t scroll yet.'
  return {
    id: `exp_${Date.now()}`,
    createdAt: new Date().toISOString(),
    hypothesis: 'A specific emotional opening will improve early retention without weakening the biblical message.',
    baseTopic: topic,
    metric: 'retention',
    status: 'PLANNED',
    variants: [
      { id: 'A', label: 'Direct', hook, opening: hook, angle: 'Direct encouragement tied to a real-life struggle.' },
      { id: 'B', label: 'Question', hook: `What if God is working even when you cannot see it?`, opening: 'Ask a tension-building question, then answer from Scripture.', angle: 'Curiosity and uncertainty resolved by Scripture.' },
      { id: 'C', label: 'Bold truth', hook: `God has not abandoned you just because you cannot see the next step.`, opening: 'Lead with a clear, reassuring truth before explaining why.', angle: 'Strong declarative reassurance grounded in Scripture.' },
    ],
  }
}

export function selectVariant(experiment: ContentExperiment, records: PerformanceRecord[]) {
  const counts = new Map(experiment.variants.map(v => [v.id, 0]))
  for (const r of records) {
    if (r.experimentId === experiment.id && r.variantId && counts.has(r.variantId)) {
      counts.set(r.variantId, (counts.get(r.variantId) || 0) + 1)
    }
  }
  const min = Math.min(...counts.values())
  return experiment.variants.find(v => counts.get(v.id) === min) || experiment.variants[0]
}

function metricScore(r: PerformanceRecord, metric: ContentExperiment['metric']) {
  if (metric === 'retention') return r.avgPercentageViewed ?? 0
  if (metric === 'engagement') return r.views ? ((r.likes + r.comments + r.shares) / r.views) * 100 : 0
  if (metric === 'follows') return r.views ? (r.follows / r.views) * 100 : 0
  return r.views
}

export function chooseWinner(records: PerformanceRecord[], experiment: ContentExperiment) {
  const perVariant = experiment.variants.map(variant => {
    const matches = records.filter(r => r.experimentId === experiment.id && r.variantId === variant.id)
    const score = matches.length ? matches.reduce((sum, r) => sum + metricScore(r, experiment.metric), 0) / matches.length : 0
    return { variantId: variant.id, label: variant.label, samples: matches.length, score }
  })
  const eligible = perVariant.filter(x => x.samples >= 3)
  if (eligible.length < experiment.variants.length) return null
  eligible.sort((a, b) => b.score - a.score)
  const best = eligible[0]
  const second = eligible[1]
  if (!best || !second || second.score <= 0) return null
  const uplift = (best.score - second.score) / second.score
  if (uplift < 0.10) return null
  return { variantId: best.variantId, score: Number(best.score.toFixed(2)), uplift: Number((uplift * 100).toFixed(1)), label: best.label, samples: best.samples }
}
