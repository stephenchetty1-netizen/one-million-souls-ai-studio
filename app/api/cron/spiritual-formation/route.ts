import { NextRequest, NextResponse } from 'next/server'
import { reviewSpiritualFormation, validateSpiritualFormation } from '../../../../lib/spiritual-formation'

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.AUTOPILOT_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const reference = body.reference || 'general Christian spiritual formation'
    const review = await reviewSpiritualFormation({
      reference,
      question: body.question || 'How should this content encourage faithful Christian prayer and spiritual growth?',
      intendedClaim: body.intendedClaim || 'Encourage faithful spiritual formation centered on Christ and Scripture.',
      gospel: body.gospel,
      discipleship: body.discipleship,
      pastoralWisdom: body.pastoralWisdom,
      content: body.content,
    })
    const validation = validateSpiritualFormation(review)
    return NextResponse.json({ ok: validation.ok, review, validation })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Formation cron failed' }, { status: 500 })
  }
}
