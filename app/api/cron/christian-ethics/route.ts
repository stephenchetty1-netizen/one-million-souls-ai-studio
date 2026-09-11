import { NextRequest, NextResponse } from 'next/server'
import { getNextContentDecision } from '@/lib/decision-agent'
import { reviewChristianEthics, saveChristianEthics, validateChristianEthics } from '@/lib/christian-ethics'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const decision = await getNextContentDecision()
    if (!decision?.topic) return NextResponse.json({ ok: false, status: 'WAIT_FOR_DATA' })
    const review = await reviewChristianEthics({ reference: process.env.BIBLE_REVIEW_REFERENCE || 'Romans 14', question: decision.topic, intendedClaim: decision.topic })
    const validation = validateChristianEthics(review)
    if (validation.ok) await saveChristianEthics(review)
    return NextResponse.json({ ok: validation.ok, review, validation })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Christian ethics cron failed' }, { status: 500 })
  }
}
