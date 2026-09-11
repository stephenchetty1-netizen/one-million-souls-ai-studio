import { NextRequest } from 'next/server'
import { buildCampaignArchitecture, saveCampaignArchitecture, validateCampaignArchitecture } from '@/lib/campaign-architect'
import { claimJob, completeJob, releaseJob } from '@/lib/jobs'

export const runtime = 'nodejs'
function authorized(req: NextRequest) { const secret = process.env.CRON_SECRET; return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`) }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const jobId = `campaign-architecture:${new Date().toISOString().slice(0, 10)}`
  if (!(await claimJob(jobId))) return Response.json({ ok: true, skipped: true, reason: 'ALREADY_CLAIMED', jobId })
  try {
    const body = await req.json().catch(() => ({}))
    const architecture = await buildCampaignArchitecture(Number(body?.days) || 14)
    if (!validateCampaignArchitecture(architecture)) throw new Error('Campaign architecture failed validation.')
    await saveCampaignArchitecture(architecture)
    await completeJob(jobId, { ok: true, campaignId: architecture.campaignId, version: 'V30' })
    return Response.json({ ok: true, jobId, campaignId: architecture.campaignId, theme: architecture.theme, episodes: architecture.episodes.length })
  } catch (error) { await releaseJob(jobId).catch(() => undefined); return Response.json({ ok: false, jobId, error: error instanceof Error ? error.message : 'Campaign architecture failed.' }, { status: 500 }) }
}
export const GET = POST
