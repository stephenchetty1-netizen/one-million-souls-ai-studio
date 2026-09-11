import { NextRequest, NextResponse } from 'next/server'
import { getNextContentDecision } from '@/lib/decision-agent'
import { reviewApologetics, saveApologetics, validateApologetics } from '@/lib/apologetics'
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try { const decision = await getNextContentDecision(); if (!decision?.topic) return NextResponse.json({ ok: false, status: 'WAIT_FOR_DATA' }); const review = await reviewApologetics({ reference: process.env.BIBLE_REVIEW_REFERENCE || '1 Peter 3:15', question: decision.topic, intendedClaim: decision.topic }); const validation = validateApologetics(review); if (validation.ok) await saveApologetics(review); return NextResponse.json({ ok: validation.ok, review, validation }) }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Apologetics cron failed' }, { status: 500 }) }
}
