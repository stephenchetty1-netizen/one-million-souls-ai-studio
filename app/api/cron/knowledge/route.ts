import { buildScriptureKnowledge, saveScriptureKnowledge, validateScriptureKnowledge } from '@/lib/scripture-intelligence'
import { getNextContentDecision } from '@/lib/decision-agent'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const decision = await getNextContentDecision()
    const topic = decision?.topic || 'Hope in Jesus when life feels uncertain'
    const knowledge = await buildScriptureKnowledge(topic)
    if (!validateScriptureKnowledge(knowledge)) return Response.json({ error: 'Scripture knowledge validation failed.' }, { status: 422 })
    await saveScriptureKnowledge(knowledge)
    return Response.json({ ok: true, topic, knowledge })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Knowledge cron failed.' }, { status: 500 })
  }
}
