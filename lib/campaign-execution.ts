import { buildCampaignPlan, type CampaignPlan, type CampaignEpisode } from './campaign-manager'

type CampaignExecutionState = {
  campaign: CampaignPlan
  scheduledEpisodeIds: string[]
  updatedAt: string
  adaptations?: Array<{ generatedAt: string; basedOnPosts: number; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; signal: 'INSUFFICIENT_DATA' | 'IMPROVING' | 'DECLINING' | 'STABLE'; recommendation: string; hookDirection: string; format: string; objective: string; changedEpisodeId?: string }>
}

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Campaign execution store failed (${response.status}).`)
  return response.json()
}

function requirePersistence() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Persistent campaign storage is required for autonomous campaign execution. Configure Upstash Redis before enabling autopilot.')
  }
}

export async function saveCampaignState(state: CampaignExecutionState) {
  requirePersistence()
  const encoded = JSON.stringify(state)
  await redis(['set', `one-million-souls:campaign:execution:${state.campaign.campaignId}`, encoded])
  await redis(['set', 'one-million-souls:campaign:active', state.campaign.campaignId])
}

async function loadState(campaignId: string) {
  const result = await redis(['get', `one-million-souls:campaign:execution:${campaignId}`])
  if (!result?.result) return null
  try { return JSON.parse(result.result) as CampaignExecutionState } catch { return null }
}

export async function getActiveCampaign(): Promise<CampaignExecutionState | null> {
  requirePersistence()
  const idResult = await redis(['get', 'one-million-souls:campaign:active'])
  const id = idResult?.result as string | undefined
  if (!id) return null
  return loadState(id)
}

export async function ensureActiveCampaign(days = 7) {
  const existing = await getActiveCampaign()
  if (existing && existing.scheduledEpisodeIds.length < existing.campaign.episodes.length) return existing
  const campaign = await buildCampaignPlan(days)
  const state: CampaignExecutionState = { campaign, scheduledEpisodeIds: [], updatedAt: new Date().toISOString() }
  await saveCampaignState(state)
  return state
}

export function nextEpisode(state: CampaignExecutionState): CampaignEpisode | null {
  return state.campaign.episodes.find(e => !state.scheduledEpisodeIds.includes(e.episodeId)) || null
}

export async function markEpisodeScheduled(campaignId: string, episodeId: string) {
  const state = await loadState(campaignId)
  if (!state) throw new Error('Campaign execution state was not found.')
  if (!state.scheduledEpisodeIds.includes(episodeId)) state.scheduledEpisodeIds.push(episodeId)
  state.updatedAt = new Date().toISOString()
  await saveCampaignState(state)
  return state
}

export type { CampaignExecutionState }
