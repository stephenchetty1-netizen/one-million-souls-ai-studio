import { getPerformance, getStrategy, type PerformanceRecord } from './learning'
import { decideNextContent, type NextContentDecision } from './decision-agent'

export type MissionSeason = 'FOUNDATION' | 'GROWTH' | 'MULTIPLICATION' | 'RENEWAL'
export type MissionStrategy = {
  generatedAt: string
  mission: string
  season: MissionSeason
  northStar: string
  audience: string
  primaryPillar: string
  secondaryPillars: string[]
  campaignTheme: string
  campaignObjective: string
  contentSeries: Array<{ name: string; purpose: string; pillar: string; formats: string[]; cadence: string }>
  priorities: string[]
  experiments: string[]
  preserve: string[]
  avoid: string[]
  evidence: { posts: number; measuredPosts: number; topTopics: string[]; topPillars: string[]; confidence: NextContentDecision['confidence'] }
  guardrails: string[]
}

const GUARDRAILS = [
  'Jesus, the Gospel, prayer, Scripture, hope, and discipleship remain the mission foundation.',
  'Verify every Scripture reference and keep verses in context.',
  'Never fabricate testimonies, quotations, miracles, results, or promises.',
  'Optimize presentation and distribution, never biblical truth.',
  'Use public analytics only; do not infer or collect sensitive private audience data.',
  'Treat performance signals as evidence, not guarantees of virality or salvation outcomes.',
]

function topValues(records: PerformanceRecord[], key: 'topic' | 'pillar') {
  const counts = new Map<string, number>()
  for (const record of records) {
    const value = (record[key] || '').trim()
    if (value) counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value]) => value)
}

function seasonFor(posts: number, decision: NextContentDecision): MissionSeason {
  if (posts < 10) return 'FOUNDATION'
  if (decision.mode === 'EXPLOIT') return 'GROWTH'
  if (posts >= 40 && decision.mode === 'BALANCED') return 'MULTIPLICATION'
  return 'RENEWAL'
}

export async function buildMissionStrategy(): Promise<MissionStrategy> {
  const [decision, records, strategy] = await Promise.all([decideNextContent(), getPerformance(200), getStrategy()])
  const measured = records.filter(r => r.views > 0)
  const season = seasonFor(measured.length, decision)
  const topTopics = topValues(measured, 'topic')
  const topPillars = topValues(measured, 'pillar')
  const primaryPillar = decision.pillar || topPillars[0] || 'Jesus & Gospel'
  const theme = decision.topic || strategy?.nextTopics?.[0] || 'Hope in Jesus'

  const series = [
    { name: 'Meet Jesus', purpose: 'Clearly present who Jesus is and why the Gospel matters.', pillar: 'Jesus & Gospel', formats: ['Direct encouragement', 'One Scripture explained'], cadence: '2x weekly' },
    { name: 'Pray This With Me', purpose: 'Turn common needs into short, Scripture-grounded prayers.', pillar: 'Prayer', formats: ['Short prayer', 'Question → Scripture → answer'], cadence: '2x weekly' },
    { name: 'Faith For Real Life', purpose: 'Connect Scripture to everyday pressure, uncertainty, identity, and decisions.', pillar: 'Scripture in Real Life', formats: ['Question → Scripture → answer', 'Direct encouragement'], cadence: '2x weekly' },
    { name: 'One Truth To Remember', purpose: 'Create highly repeatable, shareable reminders centered on biblical truth.', pillar: 'Faith & Trust', formats: ['One Scripture explained', 'Direct encouragement'], cadence: '1x weekly' },
  ]

  const priorities = season === 'FOUNDATION'
    ? ['Establish consistent Gospel-centered series', 'Build reliable performance data', 'Prioritize clarity and retention without sensationalism']
    : season === 'GROWTH'
      ? ['Scale proven topic and hook families', 'Build recognizable recurring series', 'Use controlled experiments to improve retention and follows']
      : season === 'MULTIPLICATION'
        ? ['Turn winning themes into repeatable series', 'Create more entry points for new viewers', 'Strengthen invitations toward prayer, Scripture, and discipleship']
        : ['Refresh weak creative patterns', 'Test new audience entry points', 'Preserve the strongest biblical and creative ingredients']

  return {
    generatedAt: new Date().toISOString(),
    mission: 'Reach one million souls with Jesus-centered content that points people to Scripture, hope, prayer, salvation, and discipleship.',
    season,
    northStar: 'Faithful Gospel reach: more people encounter Jesus and are invited to take a meaningful next step.',
    audience: 'People discovering or rebuilding faith who need truthful Christian encouragement, Scripture, prayer, hope, and a clear invitation toward Jesus.',
    primaryPillar,
    secondaryPillars: topPillars.filter(p => p !== primaryPillar).slice(0, 3),
    campaignTheme: theme,
    campaignObjective: decision.objective,
    contentSeries: series,
    priorities,
    experiments: [
      `Test the next hook around: ${decision.hookDirection || 'clear tension-to-hope opening'}`,
      `Test format: ${decision.format || 'Question → Scripture → answer'}`,
      topTopics.length ? `Extend the strongest observed topic family: ${topTopics[0]}` : 'Build baseline evidence across core pillars',
    ],
    preserve: decision.preserve,
    avoid: [
      'Chasing trends that weaken biblical clarity',
      'Fear-based clickbait or guaranteed outcomes',
      'Copying viral content verbatim',
      'Changing multiple major variables when evidence is limited',
    ],
    evidence: { posts: records.length, measuredPosts: measured.length, topTopics, topPillars, confidence: decision.confidence },
    guardrails: GUARDRAILS,
  }
}

export async function saveMissionStrategy(strategy: MissionStrategy) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return
  const command = ['set', 'one-million-souls:mission:strategy:latest', JSON.stringify(strategy)].map(encodeURIComponent).join('/')
  const response = await fetch(`${url}/${command}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Mission strategy store failed (${response.status}).`)
}

export async function getMissionStrategy() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/get/one-million-souls%3Amission%3Astrategy%3Alatest`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Mission strategy store failed (${response.status}).`)
  const json = await response.json()
  if (!json?.result) return null
  try { return JSON.parse(json.result) as MissionStrategy } catch { return null }
}
