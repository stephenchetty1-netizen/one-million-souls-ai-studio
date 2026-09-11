import { NextRequest } from 'next/server'
import { adaptActiveCampaign } from '@/lib/adaptive-campaign'
export const runtime = 'nodejs'
export const maxDuration = 120
function authorized(req: NextRequest) { const secret = process.env.CRON_SECRET; return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`) }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try { return Response.json({ ok: true, adaptation: await adaptActiveCampaign() }) }
  catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Campaign adaptation failed.' }, { status: 500 }) }
}
export const GET = POST
