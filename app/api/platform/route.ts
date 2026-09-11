import { z } from 'zod'
import { optimizeForPlatforms, validatePlatformPackages } from '@/lib/platform-optimizer'

const Schema = z.object({
  title: z.string().min(1).max(300),
  caption: z.string().min(1).max(5000),
  hashtags: z.array(z.string()).max(30),
  topic: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const secret = process.env.PUBLISH_SECRET || process.env.CRON_SECRET
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }
    const body = Schema.parse(await req.json())
    const packages = optimizeForPlatforms(body)
    const validation = validatePlatformPackages(packages)
    return Response.json({ ok: validation.valid, packages, validation }, { status: validation.valid ? 200 : 422 })
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: 'Invalid platform package request.' }, { status: 400 })
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Platform optimization failed.' }, { status: 500 })
  }
}
