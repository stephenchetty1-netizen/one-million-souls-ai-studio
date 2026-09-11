import { z } from 'zod'
import { savePerformance } from '@/lib/learning'

const Schema = z.object({
  id: z.string().min(1),
  platform: z.enum(['tiktok', 'youtube']),
  publishedAt: z.string(),
  title: z.string().min(1),
  hook: z.string().optional(),
  topic: z.string().optional(),
  pillar: z.string().optional(),
  views: z.number().nonnegative(),
  likes: z.number().nonnegative(),
  comments: z.number().nonnegative(),
  shares: z.number().nonnegative(),
  follows: z.number().nonnegative(),
  avgWatchSeconds: z.number().nonnegative().optional(),
  avgPercentageViewed: z.number().min(0).max(100).optional(),
  choseToViewRate: z.number().min(0).max(100).optional(),
  url: z.string().url().optional(),
})

export async function POST(req: Request) {
  try {
    const secret = process.env.ANALYTICS_INGEST_SECRET || process.env.CRON_SECRET
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    const record = Schema.parse(await req.json())
    await savePerformance(record)
    return Response.json({ ok: true, saved: record.id })
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: 'Invalid analytics payload.' }, { status: 400 })
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Analytics ingest failed.' }, { status: 500 })
  }
}
