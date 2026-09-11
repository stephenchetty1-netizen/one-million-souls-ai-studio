import { NextResponse } from 'next/server'
import { reviewChristianWisdom, validateChristianWisdom } from '@/lib/christian-wisdom'

function authorized(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return !!token && (token === process.env.CRON_SECRET || token === process.env.AUTOPILOT_SECRET)
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const review = await reviewChristianWisdom(body)
    const validation = validateChristianWisdom(review)
    return NextResponse.json({ ok: validation.ok, review, validation }, { status: validation.ok ? 200 : 422 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Wisdom review failed.' }, { status: 500 })
  }
}
