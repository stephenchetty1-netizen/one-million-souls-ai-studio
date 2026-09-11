import { getPerformance, getStrategy, summarize, type PerformanceRecord } from './learning'
import { getExperiments, type ContentExperiment } from './experiments'
import { getAudienceProfile } from './audience'
import { rankRecords, chooseNextTopic } from './growth-engine'

export type GrowthDecision = {
  generatedAt: string
  objective: string
  topic: string
  pillar: string
  hookDirection: string
  format: string
  reason: string
  experimentId?: string
  variantId?: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  evidence: { posts: number; avgViews: number; retention: number; topTopics: string[] }
}

const PILLARS = ['Faith & Trust', 'Prayer', 'Hope & Encouragement', 'Jesus & Gospel', 'Identity in Christ', 'Scripture in Real Life']
const FORMATS = ['Direct encouragement', 'Question → Scripture → answer', 'Short prayer', 'Testimony-style lesson', 'One Scripture explained']

function normalize(s = '') { return s.trim().toLowerCase() }
function metric(r: PerformanceRecord) {
  const retention = (r.avgPercentageViewed ?? 0) / 100
  const engagement = r.views ? (r.likes + r.comments + r.shares) / r.views : 0
  const follow = r.views ? r.follows / r.views : 0
  return (Math.min(r.views / 10000, 3) * 0.45) + (retention * 0.25) + (Math.min(engagement * 20, 1) * 0.15) + (Math.min(follow * 100, 1) * 0.15)
}

function topValues(records: PerformanceRecord[], key: 'topic' | 'pillar') {
  const map = new Map<string, { score: number; count: number }>()
  for (const r of records) {
    const value = key === 'topic' ? r.topic : r.pillar
    if (!value) continue
    const current = map.get(value) || { score: 0, count: 0 }
    current.score += metric(r); current.count++
    map.set(value, current)
  }
  return [...map.entries()].sort((a, b) => (b[1].score / b[1].count) - (a[1].score / a[1].count)).slice(0, 5).map(([value]) => value)
}

export async function makeGrowthDecision(): Promise<GrowthDecision> {
  const records = await getPerformance(100)
  const strategy = await getStrategy()
  const audience = await getAudienceProfile()
  const experiments = await getExperiments(30)
  const active = experiments.find(e => e.status !== 'COMPLETED')
  const ranked = rankRecords(records)
  const recentTopics = new Set(records.slice(0, 10).map(r => normalize(r.topic)).filter(Boolean))
  const strategyTopic = chooseNextTopic(strategy, records)
  const audienceTopic = audience?.topicDemand?.[0]
  const winningTopic = topValues(records, 'topic')[0]
  const candidates = [audienceTopic, strategyTopic, winningTopic, ...PILLARS].filter(Boolean) as string[]
  const topic = candidates.find(x => !recentTopics.has(normalize(x))) || strategyTopic
  const pillar = topValues(records, 'pillar')[0] || strategy?.winningTopics?.[0] || PILLARS[0]
  const hookDirection = strategy?.winningHooks?.[0] || ranked[0]?.hook || 'Lead with a clear, emotionally relevant truth and resolve it with Scripture.'
  const format = strategy?.winningFormats?.[0] || FORMATS[Math.min(records.length, FORMATS.length - 1)]
  const confidence: GrowthDecision['confidence'] = records.length >= 30 ? 'HIGH' : records.length >= 10 ? 'MEDIUM' : 'LOW'
  return {
    generatedAt: new Date().toISOString(),
    objective: 'Increase sustainable reach, retention, shares and follows while preserving biblical truth and Gospel clarity.',
    topic, pillar, hookDirection, format,
    reason: audienceTopic ? `Audience demand supports “${audienceTopic}”; performance and strategy signals are used as secondary evidence.` : records.length ? 'Decision combines observed performance with the current growth strategy while avoiding immediate topic repetition.' : 'Data is sparse, so the brain uses the mission strategy and controlled experimentation rather than pretending it has strong evidence.',
    experimentId: active?.id,
    variantId: active?.variants[0]?.id,
    confidence,
    evidence: { posts: records.length, avgViews: summarize(records).avgViews, retention: summarize(records).retention, topTopics: topValues(records, 'topic') },
  }
}

export function validateDecision(decision: GrowthDecision) {
  return Boolean(decision.topic && decision.pillar && decision.hookDirection && decision.format && decision.objective)
}
