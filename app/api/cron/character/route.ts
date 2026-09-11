import { NextRequest, NextResponse } from 'next/server'
import { reviewChristianCharacter, validateChristianCharacter } from '../../../../lib/christian-character'
function authorized(req: NextRequest) { const secret = process.env.CRON_SECRET || process.env.AUTOPILOT_SECRET; return !!secret && req.headers.get('authorization') === `Bearer ${secret}` }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const review = await reviewChristianCharacter({ reference: body.reference || 'general Christian character', audience: body.audience, question: body.question || 'Does this content encourage Christlike character faithfully?', intendedClaim: body.intendedClaim, doctrine: body.doctrine, gospel: body.gospel, discipleship: body.discipleship, ethics: body.ethics, pastoralWisdom: body.pastoralWisdom, spiritualFormation: body.spiritualFormation, community: body.community, content: body.content })
    const validation = validateChristianCharacter(review)
    return NextResponse.json({ ok: validation.ok, review, validation }, { status: validation.ok ? 200 : 422 })
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Character cron failed' }, { status: 500 }) }
}
