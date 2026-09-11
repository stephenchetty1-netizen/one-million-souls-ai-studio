import { makeGrowthDecision, validateDecision } from '@/lib/growth-brain'

export const runtime = 'nodejs'

function authorized(req: Request) {
  const secret = process.env.ANALYTICS_INGEST_SECRET || process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const decision = await makeGrowthDecision()
    if (!validateDecision(decision)) return Response.json({ ok: false, error: 'Growth decision failed validation.' }, { status: 422 })
    return Response.json({ ok: true, decision })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Growth brain failed.' }, { status: 500 })
  }
}

export const GET = POST
