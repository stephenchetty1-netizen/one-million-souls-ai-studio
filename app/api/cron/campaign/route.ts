import { NextRequest } from 'next/server'
import { buildCampaignPlan, validateCampaignPlan } from '@/lib/campaign-manager'
import { claimJob, completeJob, releaseJob } from '@/lib/jobs'

export const runtime = 'nodejs'

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const jobId = `campaign-plan:${new Date().toISOString().slice(0, 10)}`
  if (!(await claimJob(jobId))) return Response.json({ ok: true, skipped: true, reason: 'ALREADY_CLAIMED', jobId })
  try {
    const plan = await buildCampaignPlan(7)
    if (!validateCampaignPlan(plan)) throw new Error('Campaign plan failed validation.')
    await completeJob(jobId, 60 * 60 * 24 * 14)
    return Response.json({ ok: true, jobId, plan })
  } catch (error) {
    await releaseJob(jobId).catch(() => undefined)
    return Response.json({ ok: false, jobId, error: error instanceof Error ? error.message : 'Campaign planning failed.' }, { status: 500 })
  }
}
export const GET = POST
