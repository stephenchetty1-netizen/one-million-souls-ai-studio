import { getNextContentDecision } from '@/lib/decision-agent'
import { reviewPastoralWisdom, savePastoralWisdom, validatePastoralWisdom } from '@/lib/pastoral-wisdom'

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const decision = await getNextContentDecision()
    if (!decision?.topic) return Response.json({ ok: false, status: 'WAIT_FOR_DATA' })
    const review = await reviewPastoralWisdom({ reference: process.env.BIBLE_REVIEW_REFERENCE || 'Romans 14', audience: process.env.CONTENT_AUDIENCE || 'general Christian audience', question: decision.topic, intendedClaim: decision.topic, content: { topic: decision.topic } })
    const validation = validatePastoralWisdom(review)
    if (validation.ok) await savePastoralWisdom(review)
    return Response.json({ ok: validation.ok, review, validation })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Pastoral wisdom cron failed.' }, { status: 500 })
  }
}
