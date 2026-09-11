import { NextRequest } from 'next/server'
import { claimJob, completeJob } from '@/lib/jobs'
import { ensureActiveCampaign, markEpisodeScheduled, nextEpisode } from '@/lib/campaign-execution'
import { adaptActiveCampaign } from '@/lib/adaptive-campaign'
import { runContentOrchestrator } from '@/lib/orchestrator'

export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const days = Number(body?.days) || 7
  try {
    await ensureActiveCampaign(days)
    await adaptActiveCampaign()
    const refreshed = await ensureActiveCampaign(days)
    const episode = nextEpisode(refreshed)
    if (!episode) return Response.json({ ok: true, completed: true, campaign: refreshed.campaign, scheduledEpisodeIds: refreshed.scheduledEpisodeIds })
    const jobId = `campaign-execution:${refreshed.campaign.campaignId}:${episode.episodeId}`
    if (!(await claimJob(jobId, 1800))) return Response.json({ ok: true, skipped: true, reason: 'ALREADY_CLAIMED', jobId, campaignId: refreshed.campaign.campaignId, episodeId: episode.episodeId })
    const baseUrl = process.env.APP_URL || req.nextUrl.origin
    if (!/^https:\/\//.test(baseUrl)) throw new Error('APP_URL must use HTTPS for production campaign execution.')
    const result = await runContentOrchestrator(baseUrl, { campaignId: refreshed.campaign.campaignId, episodeId: episode.episodeId, topic: episode.topic, pillar: episode.pillar, hookDirection: episode.hookDirection, format: episode.format, objective: episode.objective })
    if (!result.ok) throw new Error(result.error || 'Episode orchestration failed.')
    await markEpisodeScheduled(refreshed.campaign.campaignId, episode.episodeId)
    await completeJob(jobId, 60 * 60 * 24 * 30)
    const updated = await ensureActiveCampaign(days)
    return Response.json({ ok: true, completed: updated.scheduledEpisodeIds.length >= updated.campaign.episodes.length, jobId, campaignId: refreshed.campaign.campaignId, episode, result, scheduledEpisodeIds: updated.scheduledEpisodeIds })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Campaign execution failed.' }, { status: 500 })
  }
}
export const GET = POST
