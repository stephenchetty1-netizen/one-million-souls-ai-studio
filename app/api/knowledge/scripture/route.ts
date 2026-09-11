import { buildScriptureKnowledge, validateScriptureKnowledge } from '@/lib/scripture-intelligence'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await req.json()
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : ''
    if (topic.length < 3 || topic.length > 300) return Response.json({ error: 'A topic between 3 and 300 characters is required.' }, { status: 400 })
    const knowledge = await buildScriptureKnowledge(topic)
    if (!validateScriptureKnowledge(knowledge)) return Response.json({ error: 'Scripture knowledge validation failed.' }, { status: 422 })
    return Response.json({ ok: true, knowledge })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Scripture knowledge failed.' }, { status: 500 })
  }
}
