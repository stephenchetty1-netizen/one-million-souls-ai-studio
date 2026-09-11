import { z } from 'zod'
import { scheduleMetricoolPost } from '@/lib/metricool'

const Schema = z.object({
  dateTime: z.string(),
  timezone: z.string().default('Africa/Johannesburg'),
  title: z.string().min(1),
  text: z.string().min(1),
  hashtags: z.array(z.string()).min(1),
  mediaUrl: z.string().url(),
  platformPackages: z.object({
    tiktok: z.object({ title: z.string(), caption: z.string(), hashtags: z.array(z.string()) }).optional(),
    youtube: z.object({ title: z.string(), caption: z.string(), hashtags: z.array(z.string()) }).optional(),
  }).optional(),
})

export async function POST(req: Request) {
  try {
    const secret = process.env.PUBLISH_SECRET || process.env.CRON_SECRET
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: 'Unauthorized publish request.' }, { status: 401 })
    }
    const body = Schema.parse(await req.json())
    const result = await scheduleMetricoolPost(body)
    return Response.json({ ok: true, result })
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: 'Invalid publish request.' }, { status: 400 })
    console.error(error)
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Publishing failed.' }, { status: 500 })
  }
}
