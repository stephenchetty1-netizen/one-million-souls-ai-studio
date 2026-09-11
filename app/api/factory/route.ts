import { z } from 'zod/v4'
import { buildContentFactory, validateFactoryBatch } from '@/lib/content-factory'

export const runtime = 'nodejs'

const Schema = z.object({
  topic: z.string().min(3).max(300), title: z.string().min(1).max(200), caption: z.string().min(1).max(2000),
  hashtags: z.array(z.string()).min(4).max(12), tiktokScript: z.string().min(20).max(10000),
  onScreenText: z.array(z.string()).min(3).max(8), visualConcept: z.string().min(3).max(1000),
  imagePrompts: z.array(z.string()).length(3), pillar: z.string().optional(), approvedCore: z.boolean(),
})

function authorized(req: Request) {
  const secret = process.env.ANALYTICS_INGEST_SECRET || process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const input = Schema.parse(await req.json())
    const batch = buildContentFactory(input)
    if (!validateFactoryBatch(batch)) return Response.json({ ok: false, error: 'Factory batch failed validation.' }, { status: 422 })
    return Response.json({ ok: true, batch })
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: 'Invalid approved campaign payload.' }, { status: 400 })
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Content Factory failed.' }, { status: 500 })
  }
}

export const GET = POST
