import { NextRequest } from 'next/server'
import { makeGrowthDecision, validateDecision } from '@/lib/growth-brain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const decision = await makeGrowthDecision()
    if (!validateDecision(decision)) return Response.json({ ok: false, error: 'Growth decision failed validation.' }, { status: 422 })
    return Response.json({ ok: true, decision })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Growth brain cron failed.' }, { status: 500 })
  }
}
