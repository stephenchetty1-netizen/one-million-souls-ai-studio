import { buildPostPublishReport } from '@/lib/post-publish-intelligence'
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  return Response.json({ ok: true, mode: 'POST_PUBLISH_INTELLIGENCE', report: await buildPostPublishReport() })
}
export async function POST(req: Request) { return GET(req) }
