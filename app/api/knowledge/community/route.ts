import { NextRequest, NextResponse } from 'next/server'
import { reviewChristianCommunity, validateChristianCommunity } from '../../../../lib/christian-community'

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.AUTOPILOT_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const review = await reviewChristianCommunity(await req.json())
    const validation = validateChristianCommunity(review)
    return NextResponse.json({ ok: validation.ok, review, validation }, { status: validation.ok ? 200 : 422 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Christian community review failed' }, { status: 500 })
  }
}
