import { NextRequest } from 'next/server'
import { buildCampaignPlan, validateCampaignPlan } from '@/lib/campaign-manager'

export const runtime = 'nodejs'

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const plan = await buildCampaignPlan(Number(body?.days) || 7)
    if (!validateCampaignPlan(plan)) return Response.json({ ok: false, error: 'Campaign plan failed validation.' }, { status: 422 })
    return Response.json({ ok: true, plan })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Campaign manager failed.' }, { status: 500 })
  }
}

export const GET = POST
