import { NextRequest } from 'next/server'
import { adaptActiveCampaign } from '@/lib/adaptive-campaign'
export const runtime = 'nodejs'
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try { return Response.json({ ok: true, adaptation: await adaptActiveCampaign() }) }
  catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Campaign adaptation failed.' }, { status: 500 }) }
}
export const POST = GET
