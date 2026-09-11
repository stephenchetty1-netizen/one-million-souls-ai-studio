import { decideNextContent, saveNextContentDecision } from '@/lib/decision-agent'
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const decision = await decideNextContent()
  await saveNextContentDecision(decision)
  return Response.json({ ok: true, decision })
}
export async function GET(req: Request) { return POST(req) }
