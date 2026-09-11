import { NextRequest } from 'next/server'
import { makeCreativeDirection, validateCreativeDirection } from '@/lib/creative-intelligence'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const direction = await makeCreativeDirection()
    if (!validateCreativeDirection(direction)) return Response.json({ ok: false, error: 'Creative direction failed validation.' }, { status: 422 })
    return Response.json({ ok: true, direction })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Creative intelligence cron failed.' }, { status: 500 })
  }
}
