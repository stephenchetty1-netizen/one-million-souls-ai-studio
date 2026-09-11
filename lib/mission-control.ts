import { getMissionStrategy } from './mission-strategist'
import { getCampaignArchitecture } from './campaign-architect'
import { getProgrammingCalendar } from './programming-director'
import { getNextContentDecision } from './decision-agent'
import { getPerformance } from './learning'
import { buildPostPublishReport } from './post-publish-intelligence'

export type MissionControlStatus = 'READY' | 'ATTENTION' | 'BLOCKED' | 'INSUFFICIENT_DATA'
export type MissionControlSnapshot = {
  version: 'V36'
  generatedAt: string
  status: MissionControlStatus
  mission: { season?: string; theme?: string; objective?: string }
  campaign: { campaignId?: string; theme?: string; episodes?: number; objective?: string }
  programming: { slots?: number; nextEpisodeId?: string; timezone?: string }
  decision: { mode?: string; topic?: string; confidence?: string; reason?: string }
  performance: { total: number; measured: number; latestViews?: number; latestRetention?: number; latestEngagementRate?: number; latestFollowRate?: number }
  postPublish: { status?: string; insight?: string; recommendation?: string }
  execution: { autopilotEnabled: boolean; nextAction: 'CREATE' | 'TEST' | 'WAIT_FOR_DATA' | 'BLOCKED' }
  alerts: string[]
  guardrails: string[]
}

const GUARDRAILS = [
  'Mission Control observes and coordinates; it cannot bypass biblical, safety, rights, platform, or final-video quality gates.',
  'Use aggregate/public analytics only. Never infer sensitive traits, private circumstances, salvation, or spiritual transformation.',
  'Do not fabricate testimonies, miracles, statistics, quotations, or guarantees to improve performance.',
  'When evidence is insufficient, wait or explore rather than presenting guesses as certainty.',
  'External publishing status must be reconciled with provider evidence; a scheduler response is not proof of public-live status.',
]

export async function buildMissionControlSnapshot(): Promise<MissionControlSnapshot> {
  const [mission, campaign, programming, decision, records, postPublish] = await Promise.all([
    getMissionStrategy(), getCampaignArchitecture(), getProgrammingCalendar(), getNextContentDecision(), getPerformance(30), buildPostPublishReport(),
  ])
  const measured = records.filter(r => r.views > 0)
  const latest = measured[0]
  const alerts: string[] = []
  if (!mission) alerts.push('Mission strategy is not persisted yet.')
  if (!campaign) alerts.push('Campaign architecture is not persisted yet.')
  if (!programming) alerts.push('Programming calendar is not persisted yet.')
  if (!decision) alerts.push('No persisted next-content decision is available.')
  if (measured.length < 6) alerts.push('Performance evidence is below the minimum threshold for confident optimization.')
  if (!process.env.OPENAI_API_KEY) alerts.push('OPENAI_API_KEY is not configured.')
  if (!process.env.METRICOOL_API_TOKEN) alerts.push('Metricool publishing is not configured.')
  if (!process.env.VIDEO_RENDER_WEBHOOK_URL) alerts.push('Video renderer is not configured.')
  const autopilotEnabled = process.env.AUTOPILOT_ENABLED === 'true'
  const nextAction: MissionControlSnapshot['execution']['nextAction'] = measured.length < 6 ? 'WAIT_FOR_DATA' : decision?.mode === 'EXPLORE' ? 'TEST' : decision?.mode === 'INSUFFICIENT_DATA' ? 'WAIT_FOR_DATA' : 'CREATE'
  const blocked = !process.env.OPENAI_API_KEY || !process.env.VIDEO_RENDER_WEBHOOK_URL
  return {
    version: 'V36', generatedAt: new Date().toISOString(), status: blocked ? 'BLOCKED' : alerts.length ? 'ATTENTION' : measured.length < 6 ? 'INSUFFICIENT_DATA' : 'READY',
    mission: { season: mission?.season, theme: mission?.campaignTheme, objective: mission?.campaignObjective },
    campaign: { campaignId: campaign?.campaignId, theme: campaign?.theme, episodes: campaign?.episodes.length, objective: campaign?.objective },
    programming: { slots: programming?.slots.length, nextEpisodeId: programming?.slots.find(s => s.day === Math.min(...(programming.slots.map(x => x.day))))?.episodeId, timezone: programming?.timezone },
    decision: { mode: decision?.mode, topic: decision?.topic, confidence: decision?.confidence, reason: decision?.reason },
    performance: { total: records.length, measured: measured.length, latestViews: latest?.views, latestRetention: latest?.retention, latestEngagementRate: latest?.engagementRate, latestFollowRate: latest?.followRate },
    postPublish: { status: postPublish.status, insight: postPublish.insights?.[0], recommendation: postPublish.recommendations?.[0] },
    execution: { autopilotEnabled, nextAction: blocked ? 'BLOCKED' : nextAction }, alerts, guardrails: GUARDRAILS,
  }
}

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Mission Control store failed (${response.status}).`)
  return response.json()
}
export async function saveMissionControlSnapshot(snapshot: MissionControlSnapshot) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return
  await redis(['set', 'one-million-souls:mission-control:latest', JSON.stringify(snapshot)])
}
export async function getMissionControlSnapshot() {
  const result = await redis(['get', 'one-million-souls:mission-control:latest'])
  if (!result?.result) return null
  try { return JSON.parse(result.result) as MissionControlSnapshot } catch { return null }
}
export function validateMissionControlSnapshot(s: MissionControlSnapshot) {
  return Boolean(s.version === 'V36' && s.generatedAt && s.status && s.execution?.nextAction && s.guardrails.length >= 5)
}
