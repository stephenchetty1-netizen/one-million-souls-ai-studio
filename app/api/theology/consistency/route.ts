import { reviewTheologicalConsistency, validateTheologicalConsistency, saveTheologicalConsistency } from '@/lib/theological-consistency'
import type { ScriptureKnowledge } from '@/lib/scripture-intelligence'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await req.json()
    if (!body?.topic || !body?.scripture || body?.bibleResearch === undefined || body?.content === undefined) return Response.json({ error: 'topic, scripture, bibleResearch and content are required.' }, { status: 400 })
    const review = await reviewTheologicalConsistency(body.topic, body.scripture as ScriptureKnowledge, body.bibleResearch, body.content, { interpretation: body.interpretation, hermeneutics: body.hermeneutics, canonicalTheology: body.canonicalTheology, doctrine: body.doctrine, gospel: body.gospel, gospelDiscipleship: body.gospelDiscipleship, evangelismMission: body.evangelismMission, apologetics: body.apologetics, ethics: body.ethics, pastoralWisdom: body.pastoralWisdom })
    await saveTheologicalConsistency(review)
    return Response.json({ ok: true, review, valid: validateTheologicalConsistency(review) })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Theological consistency review failed.' }, { status: 500 })
  }
}
