import { getPerformance, type PerformanceRecord } from './learning'
import { getMissionStrategy, type MissionStrategy } from './mission-strategist'
import { decideNextContent, type NextContentDecision } from './decision-agent'
import { buildCampaignPlan, type CampaignEpisode } from './campaign-manager'

export type CampaignPhase = 'DISCOVER' | 'CONNECT' | 'DEEPEN' | 'INVITE'
export type AudienceJourneyStage = {
  stage: CampaignPhase
  purpose: string
  viewerNeed: string
  contentJob: string
  cta: string
}
export type CampaignMetric = {
  name: string
  targetSignal: string
  whyItMatters: string
}
export type CampaignArchitecture = {
  version: 'V30'
  generatedAt: string
  campaignId: string
  mission: string
  season: MissionStrategy['season']
  theme: string
  objective: string
  audienceNeed: string
  journey: AudienceJourneyStage[]
  episodes: CampaignEpisode[]
  metrics: CampaignMetric[]
  experimentAllocation: { explorationPercent: number; exploitationPercent: number; rule: string }
  adaptationRules: string[]
  guardrails: string[]
  evidence: { posts: number; measuredPosts: number; confidence: NextContentDecision['confidence'] }
}

const GUARDRAILS = [
  'Every episode must pass biblical, safety, platform, and final video quality gates before publication.',
  'Verify Scripture references and preserve biblical context.',
  'Never fabricate testimonies, miracles, quotations, results, or promises.',
  'Never treat engagement, views, or follows as proof of spiritual transformation.',
  'Use aggregate/public audience signals only; never profile sensitive traits or private messages.',
  'Change one major creative variable at a time when evidence is limited.',
]

function phaseFor(index: number, total: number): CampaignPhase {
  const ratio = index / Math.max(total - 1, 1)
  if (ratio < 0.25) return 'DISCOVER'
  if (ratio < 0.5) return 'CONNECT'
  if (ratio < 0.75) return 'DEEPEN'
  return 'INVITE'
}

function ctaFor(phase: CampaignPhase) {
  if (phase === 'DISCOVER') return 'Stay for one biblical truth you can carry today.'
  if (phase === 'CONNECT') return 'Reflect, save this, and share it with someone who needs hope.'
  if (phase === 'DEEPEN') return 'Read the Scripture, pray over it, and take one faithful step.'
  return 'Pray, seek Jesus, and take your next step in faith.'
}

function journey(): AudienceJourneyStage[] {
  return [
    { stage: 'DISCOVER', purpose: 'Earn attention with a clear human need and a truthful Christian answer.', viewerNeed: 'Recognition and relevance', contentJob: 'Stop the scroll without sensationalism.', cta: ctaFor('DISCOVER') },
    { stage: 'CONNECT', purpose: 'Help viewers see their situation through the hope of Scripture.', viewerNeed: 'Hope and belonging', contentJob: 'Connect the felt need to biblical truth and Jesus.', cta: ctaFor('CONNECT') },
    { stage: 'DEEPEN', purpose: 'Move from inspiration to Scripture engagement and practical faith.', viewerNeed: 'Understanding and action', contentJob: 'Teach, pray, or explain one clear biblical truth.', cta: ctaFor('DEEPEN') },
    { stage: 'INVITE', purpose: 'Offer a meaningful next step toward Jesus and discipleship.', viewerNeed: 'Direction and response', contentJob: 'Invite prayer, Scripture reading, surrender, or Gospel response.', cta: ctaFor('INVITE') },
  ]
}

function metrics(): CampaignMetric[] {
  return [
    { name: 'Retention', targetSignal: 'Strong early retention and completion', whyItMatters: 'Shows whether the message earns enough attention to be heard.' },
    { name: 'Engagement', targetSignal: 'Healthy saves, shares, comments, and engagement rate', whyItMatters: 'Indicates that the message is resonating enough to invite response.' },
    { name: 'Follow rate', targetSignal: 'More viewers choosing to follow after exposure', whyItMatters: 'Measures whether the campaign creates a continuing relationship with the content.' },
    { name: 'Series continuity', targetSignal: 'Viewers return across related episodes', whyItMatters: 'Tests whether campaign architecture is stronger than isolated posts.' },
  ]
}

export async function buildCampaignArchitecture(days = 14): Promise<CampaignArchitecture> {
  const [mission, decision, records, baseCampaign] = await Promise.all([
    getMissionStrategy(),
    decideNextContent(),
    getPerformance(200),
    buildCampaignPlan(days),
  ])
  const effectiveMission = mission || {
    generatedAt: new Date().toISOString(), mission: 'Reach people with Jesus-centered Christian content.', season: 'FOUNDATION' as const,
    northStar: 'Faithful Gospel reach.', audience: 'People seeking Christian encouragement, Scripture, prayer, hope, and Jesus.', primaryPillar: decision.pillar || 'Jesus & Gospel', secondaryPillars: [], campaignTheme: decision.topic || 'Hope in Jesus', campaignObjective: decision.objective || 'Reach new people with truthful Christian encouragement.', contentSeries: [], priorities: [], experiments: [], preserve: decision.preserve || [], avoid: [], evidence: { posts: records.length, measuredPosts: records.filter(r => r.views > 0).length, topTopics: [], topPillars: [], confidence: decision.confidence }, guardrails: GUARDRAILS,
  }
  const theme = effectiveMission.campaignTheme || decision.topic || baseCampaign.theme
  const episodes = baseCampaign.episodes.map((episode, index) => {
    const phase = phaseFor(index, baseCampaign.episodes.length)
    return {
      ...episode,
      objective: `${episode.objective} Campaign phase: ${phase}. CTA: ${ctaFor(phase)}`,
    }
  })
  const measured = records.filter(r => r.views > 0)
  const explorationPercent = decision.mode === 'EXPLORE' ? 60 : decision.mode === 'EXPLOIT' ? 25 : 40
  return {
    version: 'V30', generatedAt: new Date().toISOString(), campaignId: baseCampaign.campaignId,
    mission: effectiveMission.mission, season: effectiveMission.season, theme,
    objective: effectiveMission.campaignObjective || decision.objective,
    audienceNeed: effectiveMission.audience,
    journey: journey(), episodes, metrics: metrics(),
    experimentAllocation: { explorationPercent, exploitationPercent: 100 - explorationPercent, rule: 'Use proven patterns for the majority while reserving controlled capacity for learning; rebalance after measured evidence.' },
    adaptationRules: [
      'If retention and engagement improve across comparable episodes, preserve the core message and vary packaging lightly.',
      'If multiple episodes decline, change one major hook or format variable before changing the campaign theme.',
      'If a series repeatedly outperforms comparable content, extend the series rather than duplicating the exact post.',
      'Do not adapt biblical truth, Scripture meaning, or Gospel clarity to chase performance.',
    ],
    guardrails: GUARDRAILS,
    evidence: { posts: records.length, measuredPosts: measured.length, confidence: decision.confidence },
  }
}

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Campaign architecture store failed (${response.status}).`)
  return response.json()
}

export async function saveCampaignArchitecture(architecture: CampaignArchitecture) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return
  await redis(['set', 'one-million-souls:campaign:architecture:latest', JSON.stringify(architecture)])
}

export async function getCampaignArchitecture() {
  const result = await redis(['get', 'one-million-souls:campaign:architecture:latest'])
  if (!result?.result) return null
  try { return JSON.parse(result.result) as CampaignArchitecture } catch { return null }
}

export function validateCampaignArchitecture(a: CampaignArchitecture) {
  return Boolean(a.version === 'V30' && a.campaignId && a.theme && a.episodes.length >= 3 && a.journey.length === 4 && a.metrics.length >= 3 && a.guardrails.length >= 4 && a.episodes.every(e => e.episodeId && e.topic && e.pillar && e.format))
}
