import { z } from 'zod'
import { buildExperiment, getExperiments, saveExperiment } from '@/lib/experiments'
import { getStrategy } from '@/lib/learning'

const Input = z.object({ topic: z.string().min(3).max(300).optional() })

export async function GET() {
  try { return Response.json({ ok: true, experiments: await getExperiments(30) }) }
  catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Failed to load experiments.' }, { status: 500 }) }
}

export async function POST(req: Request) {
  try {
    const secret = process.env.EXPERIMENT_SECRET || process.env.CRON_SECRET
    if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    const body = Input.parse(await req.json())
    const strategy = await getStrategy()
    const topic = body.topic || strategy?.nextTopics?.[0] || 'Trusting God when the way forward is unclear'
    const experiment = await saveExperiment(buildExperiment(topic, strategy?.winningHooks || []))
    return Response.json({ ok: true, experiment })
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: 'Invalid experiment request.' }, { status: 400 })
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Experiment creation failed.' }, { status: 500 })
  }
}
