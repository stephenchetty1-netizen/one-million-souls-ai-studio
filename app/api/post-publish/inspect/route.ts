import { z } from 'zod'
import { analyzePostPublish } from '@/lib/post-publish-intelligence'
const Schema = z.object({ postId: z.string().optional() })
export async function POST(req: Request) {
  try {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    const body = Schema.parse(await req.json().catch(() => ({})))
    return Response.json({ ok: true, insight: await analyzePostPublish(body.postId) })
  } catch (error) { if (error instanceof z.ZodError) return Response.json({ ok: false, error: 'Invalid post-publish request.' }, { status: 400 }); return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Post-publish analysis failed.' }, { status: 500 }) }
}
