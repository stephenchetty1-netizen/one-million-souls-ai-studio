import { getPerformance, getStrategy, type PerformanceRecord } from './learning'
import { analyzePostPublish } from './post-publish-intelligence'
import { rankRecords } from './growth-engine'

export type DecisionMode = 'INSUFFICIENT_DATA' | 'EXPLORE' | 'EXPLOIT' | 'BALANCED'
export type NextContentDecision = {
  generatedAt: string
  mode: DecisionMode
  objective: string
  topic?: string
  pillar?: string
  hookDirection?: string
  format?: string
  reason: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  preserve: string[]
  change: string[]
  evidence: { posts: number; measuredPosts: number; winningPosts: number; adaptationPosts: number; topTopics: string[]; topFormats: string[]; topPillars: string[] }
  guardrails: string[]
}

const guardrails = [
  'Keep Scripture verified and contextually faithful.',
  'Keep Jesus and the Gospel central; never optimize by weakening biblical truth.',
  'Do not use fabricated testimony, fear-based deception, guaranteed outcomes, or manipulative promises.',
  'Use public analytics only; do not collect private audience messages or personal data.',
  'Change one major creative variable at a time when evidence is limited.',
]

function top(records: PerformanceRecord[], key: 'topic' | 'format' | 'pillar') {
  const counts = new Map<string, number>()
  for (const r of records) {
    const value = key === 'format' ? r.hook : r[key]
    if (value) counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v)
}

export async function decideNextContent(): Promise<NextContentDecision> {
  const records = await getPerformance(100)
  const strategy = await getStrategy()
  const measured = records.filter(r => r.views > 0)
  if (measured.length < 6) {
    return {
      generatedAt: new Date().toISOString(), mode: 'INSUFFICIENT_DATA', objective: 'Build reliable learning data while maintaining biblical consistency.',
      reason: 'There are not enough measured posts to make a strong autonomous strategic change.', confidence: 'LOW',
      evidence: { posts: records.length, measuredPosts: measured.length, winningPosts: 0, adaptationPosts: 0, topTopics: top(measured, 'topic'), topFormats: top(measured, 'format'), topPillars: top(measured, 'pillar') },
      preserve: ['Current approved content strategy'], change: ['No major variable until more evidence is available'], guardrails,
    }
  }

  const insights = await Promise.all(measured.slice(0, Math.min(12, measured.length)).map(r => analyzePostPublish(r.id)))
  const winners = insights.filter(i => i.status === 'WINNER')
  const adaptations = insights.filter(i => i.status === 'NEEDS_ADAPTATION')
  const ranked = rankRecords(measured)
  const winnerRecords = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.2)))
  const topTopics = top(winnerRecords, 'topic')
  const topPillars = top(winnerRecords, 'pillar')
  const topFormats = top(winnerRecords, 'format')
  const latestInsight = insights[0]

  let mode: DecisionMode = 'BALANCED'
  let reason = 'Performance is mixed; preserve proven elements and test one controlled variation.'
  let objective = 'Improve retention, meaningful engagement, and follows while preserving biblical clarity.'
  let hookDirection = latestInsight?.nextExperiment?.hookDirection || 'Clear tension-to-hope opening'
  let format = latestInsight?.nextExperiment?.format || topFormats[0] || 'Question → Scripture → answer'
  let topic = latestInsight?.nextExperiment?.topic || topTopics[0] || strategy?.nextTopics?.[0]

  if (winners.length >= 2 && winners.length >= adaptations.length) {
    mode = 'EXPLOIT'
    reason = 'Recent comparable posts show repeatable winning signals, so the next post should preserve the strongest pattern while changing one controlled element.'
    objective = 'Extend a proven creative pattern to reach more people without copying content verbatim.'
    hookDirection = winners[0]?.nextExperiment?.hookDirection || hookDirection
    format = winners[0]?.nextExperiment?.format || format
    topic = winners[0]?.nextExperiment?.topic || topic
  } else if (adaptations.length >= 2) {
    mode = 'EXPLORE'
    reason = 'Recent posts show meaningful underperformance, so the next post should test a different hook or format while keeping the biblical core intact.'
    objective = 'Recover early retention and engagement through a controlled creative change.'
    hookDirection = 'Question-first or tension-to-hope opening'
    format = 'Direct encouragement'
  }

  return {
    generatedAt: new Date().toISOString(), mode, objective, topic, pillar: topPillars[0] || undefined, hookDirection, format, reason,
    confidence: measured.length >= 20 ? 'HIGH' : measured.length >= 10 ? 'MEDIUM' : 'LOW',
    preserve: topTopics.length ? [`Winning topic family: ${topTopics.join(', ')}`, 'Verified Scripture and Jesus-centered message', 'The strongest observed creative ingredient'] : ['Biblical core and current strategy'],
    change: mode === 'EXPLOIT' ? ['One controlled variation around the winning pattern'] : mode === 'EXPLORE' ? ['Opening hook or format'] : ['One modest creative variation'],
    evidence: { posts: records.length, measuredPosts: measured.length, winningPosts: winners.length, adaptationPosts: adaptations.length, topTopics, topFormats, topPillars }, guardrails,
  }
}

export async function saveNextContentDecision(decision: NextContentDecision) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return
  const command = ['set', 'one-million-souls:decision:latest', JSON.stringify(decision)].map(encodeURIComponent).join('/')
  const response = await fetch(`${url}/${command}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Decision store failed (${response.status}).`)
}

export async function getNextContentDecision() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/get/one-million-souls%3Adecision%3Alatest`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Decision store failed (${response.status}).`)
  const json = await response.json()
  if (!json?.result) return null
  try { return JSON.parse(json.result) as NextContentDecision } catch { return null }
}
