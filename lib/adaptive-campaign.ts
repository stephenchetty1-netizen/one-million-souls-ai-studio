import { getPerformance, type PerformanceRecord } from './learning'
import { getActiveCampaign, saveCampaignState, type CampaignExecutionState } from './campaign-execution'

export type Adaptation = {
  generatedAt: string
  basedOnPosts: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  signal: 'INSUFFICIENT_DATA' | 'IMPROVING' | 'DECLINING' | 'STABLE'
  recommendation: string
  hookDirection: string
  format: string
  objective: string
  changedEpisodeId?: string
}

function rate(values: PerformanceRecord[], key: 'likes' | 'comments' | 'shares' | 'follows') {
  const views = values.reduce((n, r) => n + r.views, 0)
  if (!views) return 0
  return values.reduce((n, r) => n + r[key], 0) / views
}

function retention(values: PerformanceRecord[]) {
  const usable = values.filter(r => r.avgPercentageViewed != null)
  if (!usable.length) return 0
  return usable.reduce((n, r) => n + Number(r.avgPercentageViewed || 0), 0) / usable.length
}

function delta(current: number, previous: number) {
  if (!previous) return current > 0 ? 1 : 0
  return (current - previous) / previous
}

function nextFormat(current: string, signal: Adaptation['signal']) {
  if (signal === 'IMPROVING') return current
  if (signal === 'DECLINING') {
    if (current.includes('Direct')) return 'Question → Scripture → answer'
    if (current.includes('Question')) return 'Direct encouragement'
    return 'One Scripture explained'
  }
  return current
}

export async function adaptActiveCampaign(): Promise<Adaptation | null> {
  const state = await getActiveCampaign()
  if (!state) return null
  const next = state.campaign.episodes.find(e => !state.scheduledEpisodeIds.includes(e.episodeId))
  if (!next) return null

  const records = await getPerformance(30)
  if (records.length < 6) {
    const adaptation: Adaptation = {
      generatedAt: new Date().toISOString(), basedOnPosts: records.length,
      confidence: 'LOW', signal: 'INSUFFICIENT_DATA',
      recommendation: 'Keep the planned episode direction until enough fresh performance data exists to justify a change.',
      hookDirection: next.hookDirection, format: next.format,
      objective: next.objective, changedEpisodeId: next.episodeId,
    }
    return persistAdaptation(state, adaptation)
  }

  const current = records.slice(0, 3)
  const previous = records.slice(3, 6)
  const currentRetention = retention(current)
  const previousRetention = retention(previous)
  const currentEngagement = rate(current, 'likes') + rate(current, 'comments') + rate(current, 'shares')
  const previousEngagement = rate(previous, 'likes') + rate(previous, 'comments') + rate(previous, 'shares')
  const currentFollow = rate(current, 'follows')
  const previousFollow = rate(previous, 'follows')
  const composite = (delta(currentRetention, previousRetention) + delta(currentEngagement, previousEngagement) + delta(currentFollow, previousFollow)) / 3
  const signal: Adaptation['signal'] = composite > 0.08 ? 'IMPROVING' : composite < -0.08 ? 'DECLINING' : 'STABLE'

  let hookDirection = next.hookDirection
  let objective = next.objective
  if (signal === 'IMPROVING') {
    hookDirection = `${hookDirection} Preserve the proven emotional clarity; make the opening immediately specific.`
    objective = `${objective} Continue the creative direction that is showing positive audience response.`
  } else if (signal === 'DECLINING') {
    hookDirection = 'Use a fresh, specific opening question or tension point, then resolve it clearly with verified Scripture and Jesus-centered hope.'
    objective = `${objective} Change the opening and presentation rather than repeating the recent approach.`
  } else {
    hookDirection = `${hookDirection} Keep the core message stable while testing one meaningful presentation change.`
  }

  const adaptation: Adaptation = {
    generatedAt: new Date().toISOString(), basedOnPosts: records.length,
    confidence: records.length >= 15 ? 'HIGH' : 'MEDIUM', signal,
    recommendation: signal === 'IMPROVING'
      ? 'Recent signals are improving; preserve the strongest direction and make only small refinements.'
      : signal === 'DECLINING'
        ? 'Recent signals are weakening; change the opening/format while preserving the campaign theme and biblical core.'
        : 'Recent signals are broadly stable; retain the campaign direction and test one controlled variation.',
    hookDirection, format: nextFormat(next.format, signal), objective, changedEpisodeId: next.episodeId,
  }
  return persistAdaptation(state, adaptation)
}

async function persistAdaptation(state: CampaignExecutionState, adaptation: Adaptation) {
  const episode = state.campaign.episodes.find(e => e.episodeId === adaptation.changedEpisodeId)
  if (episode) {
    episode.hookDirection = adaptation.hookDirection
    episode.format = adaptation.format
    episode.objective = adaptation.objective
  }
  state.adaptations = [...(state.adaptations || []).filter(a => a.changedEpisodeId !== adaptation.changedEpisodeId), adaptation]
  state.updatedAt = new Date().toISOString()
  await saveCampaignState(state)
  return adaptation
}
