import { z } from 'zod'
import { buildDistributionPlan, validateDistributionPlan } from '@/lib/distribution-intelligence'

const Schema = z.object({
  title: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).min(1),
  topic: z.string().optional(),
  dateTime: z.string().min(1),
  timezone: z.string().min(1),
  objective: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    const body = Schema.parse(await req.json())
    const plan = buildDistributionPlan(body)
    const validation = validateDistributionPlan(plan)
    if (!validation.valid) return Response.json({ ok: false, error: 'Distribution plan failed validation.', validation }, { status: 422 })
    return Response.json({ ok: true, plan, validation })
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: 'Invalid distribution request.' }, { status: 400 })
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Distribution planning failed.' }, { status: 500 })
  }
}
