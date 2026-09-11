import { NextRequest, NextResponse } from 'next/server'
import { reviewSpiritualFormation, validateSpiritualFormation } from '../../../../lib/spiritual-formation'

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.AUTOPILOT_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const review = await reviewSpiritualFormation(body)
    const validation = validateSpiritualFormation(review)
    return NextResponse.json({ ok: validation.ok, review, validation }, { status: validation.ok ? 200 : 422 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Formation review failed' }, { status: 500 })
  }
}
