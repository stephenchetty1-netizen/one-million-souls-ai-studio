import { NextResponse } from 'next/server'
import { getChristianDiscernment, reviewChristianDiscernment, validateChristianDiscernment } from '@/lib/christian-discernment'

function authorized(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return !!token && token === process.env.CRON_SECRET
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const existing = await getChristianDiscernment()
    if (existing) return NextResponse.json({ ok: true, cached: true, review: existing, validation: validateChristianDiscernment(existing) })
    const review = await reviewChristianDiscernment({ reference: 'Proverbs 3:5-6', question: 'How should an autonomous Christian content system decide whether to proceed, revise, research, escalate, or block?' })
    return NextResponse.json({ ok: true, cached: false, review, validation: validateChristianDiscernment(review) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Discernment refresh failed.' }, { status: 500 })
  }
}
