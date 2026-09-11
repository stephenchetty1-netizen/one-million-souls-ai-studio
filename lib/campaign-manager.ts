import { getPerformance, type PerformanceRecord } from './learning'
import { makeGrowthDecision, type GrowthDecision } from './growth-brain'

export type CampaignEpisode = {
  episodeId: string
  day: number
  topic: string
  pillar: string
  hookDirection: string
  format: string
  objective: string
}

export type CampaignPlan = {
  campaignId: string
  generatedAt: string
  name: string
  mission: string
  durationDays: number
  primaryPillar: string
  theme: string
  episodes: CampaignEpisode[]
  strategy: 'EXPLOIT' | 'EXPLORE' | 'BALANCED'
  confidence: GrowthDecision['confidence']
  guardrails: string[]
}

const GUARDRAILS = [
  'Every episode must pass Scripture verification and the biblical quality gate.',
  'Do not fabricate quotations, references, testimonies, results, or promises.',
  'Creative experimentation may change packaging, not biblical truth.',
  'Avoid publishing near-duplicate episodes; preserve topic and hook variety.',
  'Use performance data as evidence, never as a guarantee of virality.',
]

function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) }
function recentTopics(records: PerformanceRecord[]) { return new Set(records.slice(0, 14).map(r => (r.topic || '').trim().toLowerCase()).filter(Boolean)) }

export async function buildCampaignPlan(days = 7): Promise<CampaignPlan> {
  const safeDays = Math.min(Math.max(Math.floor(days), 3), 14)
  const [decision, records] = await Promise.all([makeGrowthDecision(), getPerformance(150)])
  const recent = recentTopics(records)
  const episodes: CampaignEpisode[] = []
  const theme = decision.topic
  const baseTopics = [
    decision.topic,
    `Why ${decision.topic} matters when life feels uncertain`,
    `A prayer for ${decision.topic}`,
    `What Scripture teaches about ${decision.topic}`,
    `Keep trusting Jesus through ${decision.topic}`,
    `One truth to remember about ${decision.topic}`,
    `Choose faith in the middle of ${decision.topic}`,
    `Jesus is with you in ${decision.topic}`,
    `A biblical reset for ${decision.topic}`,
    `How to respond to ${decision.topic} with faith`,
    `Hope for anyone facing ${decision.topic}`,
    `A Scripture-centered reminder about ${decision.topic}`,
    `What to do next when ${decision.topic} feels overwhelming`,
    `Let God lead you through ${decision.topic}`,
  ]
  const formats = ['Direct encouragement', 'Question → Scripture → answer', 'Short prayer', 'One Scripture explained', 'Testimony-style lesson']
  for (let i = 0; i < safeDays; i++) {
    let topic = baseTopics[i % baseTopics.length]
    if (recent.has(topic.toLowerCase()) && i < baseTopics.length - 1) topic = baseTopics[(i + 1) % baseTopics.length]
    episodes.push({
      episodeId: `${slug(decision.topic)}-ep-${String(i + 1).padStart(2, '0')}`,
      day: i + 1,
      topic,
      pillar: decision.pillar,
      hookDirection: i === 0 ? decision.hookDirection : `${decision.hookDirection} Vary the opening so this episode stands on its own.`,
      format: formats[i % formats.length],
      objective: i === 0 ? 'Establish the campaign theme and invite viewers into the journey.' : 'Deliver one distinct, Scripture-grounded takeaway that advances the campaign theme.',
    })
  }
  const strategy: CampaignPlan['strategy'] = records.length >= 30 ? 'EXPLOIT' : records.length >= 10 ? 'BALANCED' : 'EXPLORE'
  return {
    campaignId: `campaign-${slug(decision.topic)}-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    name: `${safeDays}-Day Faith Series: ${decision.topic}`,
    mission: 'Reach people with truthful, Jesus-centered Christian content that encourages faith, hope, Scripture engagement, and discipleship.',
    durationDays: safeDays,
    primaryPillar: decision.pillar,
    theme,
    episodes,
    strategy,
    confidence: decision.confidence,
    guardrails: GUARDRAILS,
  }
}

export function validateCampaignPlan(plan: CampaignPlan) {
  return Boolean(
    plan.campaignId && plan.name && plan.theme && plan.episodes.length >= 3 &&
    plan.episodes.every(e => e.episodeId && e.topic && e.pillar && e.hookDirection && e.format)
  )
}
