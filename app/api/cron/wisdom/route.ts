import { NextResponse } from 'next/server'
import { getChristianWisdom } from '@/lib/christian-wisdom'
import { reviewChristianWisdom, validateChristianWisdom } from '@/lib/christian-wisdom'

function authorized(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return !!token && token === process.env.CRON_SECRET
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const existing = await getChristianWisdom()
    if (existing) return NextResponse.json({ ok: true, cached: true, review: existing, validation: validateChristianWisdom(existing) })
    const review = await reviewChristianWisdom({ reference: 'Proverbs 3:5-6', question: 'How should Christian content encourage wise decisions without claiming private revelation?' })
    return NextResponse.json({ ok: true, cached: false, review, validation: validateChristianWisdom(review) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Wisdom refresh failed.' }, { status: 500 })
  }
}
