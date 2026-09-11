import { NextRequest, NextResponse } from 'next/server'
import { getNextContentDecision } from '@/lib/decision-agent'
import { reviewEvangelismMission, saveEvangelismMission, validateEvangelismMission } from '@/lib/evangelism-mission'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const decision = await getNextContentDecision()
    if (!decision?.topic) return NextResponse.json({ ok: false, status: 'WAIT_FOR_DATA' })
    const review = await reviewEvangelismMission({ reference: process.env.BIBLE_REVIEW_REFERENCE || 'Matthew 28:18-20', intendedClaim: decision.topic })
    const validation = validateEvangelismMission(review)
    if (validation.ok) await saveEvangelismMission(review)
    return NextResponse.json({ ok: validation.ok, review, validation })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Evangelism & mission cron failed' }, { status: 500 })
  }
}
