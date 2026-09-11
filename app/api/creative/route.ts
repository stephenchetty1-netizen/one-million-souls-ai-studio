import { makeCreativeDirection, validateCreativeDirection } from '@/lib/creative-intelligence'

export const runtime = 'nodejs'

function authorized(req: Request) {
  const secret = process.env.ANALYTICS_INGEST_SECRET || process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const direction = await makeCreativeDirection()
    if (!validateCreativeDirection(direction)) return Response.json({ ok: false, error: 'Creative direction failed validation.' }, { status: 422 })
    return Response.json({ ok: true, direction })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Creative intelligence failed.' }, { status: 500 })
  }
}

export const GET = POST
