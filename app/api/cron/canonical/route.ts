import { NextRequest, NextResponse } from 'next/server'
import { getNextContentDecision } from '@/lib/decision-agent'
import { reviewBiblicalTheology, validateBiblicalTheology, saveBiblicalTheology } from '@/lib/biblical-theology'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const decision = await getNextContentDecision()
    if (!decision?.topic) return NextResponse.json({ ok: false, status: 'WAIT_FOR_DATA' })
    const review = await reviewBiblicalTheology({ reference: 'decision-topic', intendedClaim: decision.topic })
    const validation = validateBiblicalTheology(review)
    if (validation.ok) await saveBiblicalTheology(review)
    return NextResponse.json({ ok: validation.ok, review, validation })
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Canonical theology cron failed' }, { status: 500 }) }
}
