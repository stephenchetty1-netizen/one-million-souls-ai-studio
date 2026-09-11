import { NextRequest } from 'next/server'
import { runContentOrchestrator } from '@/lib/orchestrator'

export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const baseUrl = process.env.APP_URL || req.nextUrl.origin
    if (!/^https:\/\//.test(baseUrl)) return Response.json({ ok: false, error: 'APP_URL must use HTTPS for production orchestration.' }, { status: 422 })
    const result = await runContentOrchestrator(baseUrl)
    return Response.json(result, { status: result.ok ? 200 : 422 })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Orchestration failed.' }, { status: 500 })
  }
}

export const POST = GET
