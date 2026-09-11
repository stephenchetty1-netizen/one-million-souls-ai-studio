import { z } from 'zod'
import { scheduleMetricoolPost } from '@/lib/metricool'

const Schema = z.object({
  dateTime: z.string().min(1),
  timezone: z.string().min(1),
  mediaUrl: z.string().url(),
  plan: z.object({
    version: z.literal('V26'),
    packages: z.object({
      tiktok: z.object({ title: z.string(), caption: z.string(), hashtags: z.array(z.string()) }),
      youtube: z.object({ title: z.string(), caption: z.string(), hashtags: z.array(z.string()) }),
    }),
  }),
})

export async function POST(req: Request) {
  try {
    const secret = process.env.PUBLISH_SECRET || process.env.CRON_SECRET
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    const body = Schema.parse(await req.json())
    const result = await scheduleMetricoolPost({
      dateTime: body.dateTime,
      timezone: body.timezone,
      title: body.plan.packages.youtube.title,
      text: body.plan.packages.tiktok.caption,
      hashtags: body.plan.packages.tiktok.hashtags,
      mediaUrl: body.mediaUrl,
      platformPackages: body.plan.packages,
    })
    return Response.json({ ok: true, scheduled: true, result })
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: 'Invalid distribution publish request.' }, { status: 400 })
    console.error(error)
    return Response.json({ ok: false, scheduled: false, error: error instanceof Error ? error.message : 'Distribution publishing failed.' }, { status: 500 })
  }
}
