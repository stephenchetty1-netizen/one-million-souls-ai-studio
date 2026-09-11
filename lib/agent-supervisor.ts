import { buildMissionControlSnapshot } from './mission-control'
import { getMissionStrategy } from './mission-strategist'
import { getCampaignArchitecture } from './campaign-architect'
import { getProgrammingCalendar } from './programming-director'
import { getNextContentDecision } from './decision-agent'
import { getPerformance } from './learning'

export type SpecialistName = 'MISSION' | 'CAMPAIGN' | 'PROGRAMMING' | 'DECISION' | 'CREATIVE' | 'PRODUCTION' | 'DISTRIBUTION' | 'ANALYTICS'
export type SupervisorStatus = 'READY' | 'ATTENTION' | 'BLOCKED' | 'INSUFFICIENT_DATA'
export type SupervisorAction = 'EXECUTE' | 'RESEARCH' | 'WAIT_FOR_DATA' | 'REPAIR' | 'BLOCK'
export type SpecialistState = { name: SpecialistName; available: boolean; priority: number; reason?: string }
export type AgentSupervisorSnapshot = {
  version: 'V37'
  generatedAt: string
  status: SupervisorStatus
  action: SupervisorAction
  objective: string
  activeSpecialists: SpecialistState[]
  executionOrder: SpecialistName[]
  conflicts: string[]
  dependencies: Record<string, string[]>
  checks: { mission: boolean; campaign: boolean; programming: boolean; decision: boolean; persistence: boolean; autopilotEnabled: boolean }
  guardrails: string[]
}

const ORDER: SpecialistName[] = ['MISSION','CAMPAIGN','PROGRAMMING','DECISION','CREATIVE','PRODUCTION','DISTRIBUTION','ANALYTICS']
const GUARDRAILS = [
  'Supervisor coordinates specialists; it cannot bypass biblical, safety, rights, platform, or final-video quality gates.',
  'Only aggregate/public analytics may inform decisions. Never infer sensitive traits, private circumstances, salvation, or spiritual transformation.',
  'No specialist may fabricate Scripture, testimony, statistics, quotations, miracles, or spiritual guarantees.',
  'When specialists disagree, preserve the highest-priority safety and biblical constraints and choose the least-assumptive action.',
  'Publishing status must be reconciled with provider evidence; a scheduler response alone is not proof of public-live status.',
]

function specialist(name: SpecialistName, available: boolean, priority: number, reason?: string): SpecialistState { return { name, available, priority, ...(reason ? { reason } : {}) } }

export async function buildAgentSupervisorSnapshot(): Promise<AgentSupervisorSnapshot> {
  const [control, mission, campaign, programming, decision, records] = await Promise.all([
    buildMissionControlSnapshot(), getMissionStrategy(), getCampaignArchitecture(), getProgrammingCalendar(), getNextContentDecision(), getPerformance(30),
  ])
  const measured = records.filter(r => r.views > 0)
  const conflicts: string[] = []
  if (control.execution.nextAction === 'BLOCKED') conflicts.push('Mission Control is blocking execution.')
  if (decision?.topic && mission?.campaignTheme && decision.topic.toLowerCase() === mission.campaignTheme.toLowerCase()) {
    // aligned, no conflict
  }
  if (decision?.mode === 'INSUFFICIENT_DATA' && measured.length >= 6) conflicts.push('Decision Agent reports insufficient data despite the supervisor seeing six or more measured records.')
  if (programming && campaign && programming.slots.length === 0 && campaign.episodes.length > 0) conflicts.push('Campaign has episodes but Programming has no executable slots.')
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) conflicts.push('Persistent state is unavailable; autonomous coordination must not run.')

  const activeSpecialists: SpecialistState[] = [
    specialist('MISSION', Boolean(mission), 100, mission ? undefined : 'Mission strategy unavailable.'),
    specialist('CAMPAIGN', Boolean(campaign), 90, campaign ? undefined : 'Campaign architecture unavailable.'),
    specialist('PROGRAMMING', Boolean(programming?.slots?.length), 80, programming?.slots?.length ? undefined : 'No executable calendar slots.'),
    specialist('DECISION', Boolean(decision), 70, decision ? undefined : 'No persisted decision available.'),
    specialist('CREATIVE', Boolean(process.env.OPENAI_API_KEY), 60, process.env.OPENAI_API_KEY ? undefined : 'OpenAI is not configured.'),
    specialist('PRODUCTION', Boolean(process.env.VIDEO_RENDER_WEBHOOK_URL), 50, process.env.VIDEO_RENDER_WEBHOOK_URL ? undefined : 'Renderer is not configured.'),
    specialist('DISTRIBUTION', Boolean(process.env.METRICOOL_API_TOKEN), 40, process.env.METRICOOL_API_TOKEN ? undefined : 'Metricool is not configured.'),
    specialist('ANALYTICS', measured.length > 0, 30, measured.length ? undefined : 'No measured public performance records.'),
  ]

  const hardBlocked = !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN || !process.env.OPENAI_API_KEY || !process.env.VIDEO_RENDER_WEBHOOK_URL || control.status === 'BLOCKED'
  const incomplete = !mission || !campaign || !programming || !decision
  let status: SupervisorStatus = hardBlocked ? 'BLOCKED' : incomplete || measured.length < 6 ? 'INSUFFICIENT_DATA' : conflicts.length ? 'ATTENTION' : 'READY'
  let action: SupervisorAction = hardBlocked ? 'BLOCK' : conflicts.length ? 'REPAIR' : measured.length < 6 ? 'WAIT_FOR_DATA' : decision?.mode === 'EXPLORE' ? 'RESEARCH' : 'EXECUTE'
  if (status === 'ATTENTION' && !hardBlocked) action = 'REPAIR'

  return {
    version: 'V37', generatedAt: new Date().toISOString(), status, action,
    objective: decision?.objective || mission?.campaignObjective || 'Reach people with truthful, Scripture-grounded Christian content that points to Jesus.',
    activeSpecialists: activeSpecialists.sort((a,b) => b.priority - a.priority),
    executionOrder: ORDER,
    conflicts,
    dependencies: {
      MISSION: [], CAMPAIGN: ['MISSION'], PROGRAMMING: ['CAMPAIGN'], DECISION: ['MISSION','CAMPAIGN','PROGRAMMING','ANALYTICS'],
      CREATIVE: ['DECISION'], PRODUCTION: ['CREATIVE'], DISTRIBUTION: ['PRODUCTION'], ANALYTICS: ['DISTRIBUTION'],
    },
    checks: { mission: Boolean(mission), campaign: Boolean(campaign), programming: Boolean(programming), decision: Boolean(decision), persistence: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN), autopilotEnabled: process.env.AUTOPILOT_ENABLED === 'true' },
    guardrails: GUARDRAILS,
  }
}

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Supervisor store failed (${response.status}).`)
  return response.json()
}
export async function saveAgentSupervisorSnapshot(snapshot: AgentSupervisorSnapshot) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error('Persistent state is required for supervisor snapshots.')
  await redis(['set','one-million-souls:agent-supervisor:latest',JSON.stringify(snapshot)])
}
export async function getAgentSupervisorSnapshot() {
  const result = await redis(['get','one-million-souls:agent-supervisor:latest'])
  if (!result?.result) return null
  try { return JSON.parse(result.result) as AgentSupervisorSnapshot } catch { return null }
}
export function validateAgentSupervisorSnapshot(s: AgentSupervisorSnapshot) {
  return s.version === 'V37' && Boolean(s.generatedAt && s.status && s.action) && s.executionOrder.length === 8 && s.guardrails.length >= 5
}
