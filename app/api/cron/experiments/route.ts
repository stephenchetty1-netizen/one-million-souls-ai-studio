import { getPerformance } from '@/lib/learning'
import { chooseWinner, getExperiments, saveExperiment } from '@/lib/experiments'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const records = await getPerformance(300)
    const experiments = await getExperiments(30)
    const completed = []
    for (const experiment of experiments) {
      if (experiment.status === 'COMPLETED') continue
      const winner = chooseWinner(records, experiment)
      if (winner) {
        const updated = await saveExperiment({ ...experiment, winnerId: winner.variantId, status: 'COMPLETED' })
        completed.push({ experiment: updated.id, winner })
      }
    }
    return Response.json({ ok: true, evaluated: experiments.length, completed })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Experiment evaluation failed.' }, { status: 500 })
  }
}
