import { getNextContentDecision } from '@/lib/decision-agent'
import { getScriptureKnowledge } from '@/lib/scripture-intelligence'
import { reviewTheologicalConsistency, saveTheologicalConsistency } from '@/lib/theological-consistency'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const decision = await getNextContentDecision()
    const scripture = await getScriptureKnowledge()
    if (!decision?.topic || !scripture) return Response.json({ ok: false, error: 'No decision or Scripture Intelligence record is available for review.' }, { status: 409 })
    return Response.json({ ok: true, status: 'READY_FOR_CONTENT_REVIEW', topic: decision.topic, scriptureReference: scripture.primaryReference })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Theology cron check failed.' }, { status: 500 })
  }
}
