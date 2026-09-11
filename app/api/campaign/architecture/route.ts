import { NextRequest } from 'next/server'
import { buildCampaignArchitecture, saveCampaignArchitecture, validateCampaignArchitecture } from '@/lib/campaign-architect'

export const runtime = 'nodejs'
function authorized(req: NextRequest) { const secret = process.env.CRON_SECRET; return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`) }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const architecture = await buildCampaignArchitecture(Number(body?.days) || 14)
    if (!validateCampaignArchitecture(architecture)) return Response.json({ ok: false, error: 'Campaign architecture failed validation.' }, { status: 422 })
    await saveCampaignArchitecture(architecture)
    return Response.json({ ok: true, architecture })
  } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Campaign architecture failed.' }, { status: 500 }) }
}
export const GET = POST
