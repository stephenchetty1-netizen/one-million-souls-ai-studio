import { NextRequest, NextResponse } from 'next/server'
import { reviewChristianCommunity, validateChristianCommunity } from '../../../../lib/christian-community'
function authorized(req: NextRequest) { const secret = process.env.CRON_SECRET || process.env.AUTOPILOT_SECRET; return !!secret && req.headers.get('authorization') === `Bearer ${secret}` }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const review = await reviewChristianCommunity({ reference: body.reference || 'general Christian community', audience: body.audience, question: body.question || 'How should this content encourage healthy Christian community and church life?', intendedClaim: body.intendedClaim || 'Encourage biblical fellowship, discipleship, service, unity, and healthy human relationships.', gospel: body.gospel, discipleship: body.discipleship, ethics: body.ethics, pastoralWisdom: body.pastoralWisdom, spiritualFormation: body.spiritualFormation, content: body.content })
    const validation = validateChristianCommunity(review)
    return NextResponse.json({ ok: validation.ok, review, validation }, { status: validation.ok ? 200 : 422 })
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Community cron failed' }, { status: 500 }) }
}
