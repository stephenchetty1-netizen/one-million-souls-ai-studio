import { getPerformance, getStrategy, saveStrategy, summarize, type PerformanceRecord, type GrowthStrategy } from './learning'

export function scoreRecord(record: PerformanceRecord, baselineViews: number) {
  const viewsScore = baselineViews ? Math.min(record.views / baselineViews, 3) : 0
  const engagement = record.views ? (record.likes + record.comments + record.shares) / record.views : 0
  const follow = record.views ? record.follows / record.views : 0
  const retention = (record.avgPercentageViewed ?? 0) / 100
  const chose = (record.choseToViewRate ?? 0) / 100
  return Number((viewsScore * 0.35 + engagement * 20 * 0.25 + follow * 100 * 0.15 + retention * 0.15 + chose * 0.10).toFixed(4))
}

export function rankRecords(records: PerformanceRecord[]) {
  const baseline = records.length ? records.reduce((n, r) => n + r.views, 0) / records.length : 0
  return [...records].sort((a, b) => scoreRecord(b, baseline) - scoreRecord(a, baseline))
}

export function chooseNextTopic(strategy: GrowthStrategy | null, records: PerformanceRecord[]) {
  const ranked = rankRecords(records)
  const recentTopics = new Set(records.slice(0, 7).map(r => (r.topic || '').toLowerCase()).filter(Boolean))
  const candidates = strategy?.nextTopics || []
  const fresh = candidates.find(topic => !recentTopics.has(topic.toLowerCase()))
  if (fresh) return fresh
  const winning = ranked.map(r => r.topic).filter(Boolean).find(topic => !recentTopics.has(topic!.toLowerCase()))
  return winning || candidates[0] || 'Trusting God when the way forward is unclear'
}

export async function refreshGrowthStrategy() {
  const records = await getPerformance(100)
  const stats = summarize(records)
  const previous = await getStrategy()
  return { records, stats, previous, suggestedTopic: chooseNextTopic(previous, records) }
}
