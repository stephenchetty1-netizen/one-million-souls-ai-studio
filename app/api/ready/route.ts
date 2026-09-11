import { NextRequest } from 'next/server'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const checks = {
    openai: Boolean(process.env.OPENAI_API_KEY),
    metricool: Boolean(process.env.METRICOOL_API_TOKEN && process.env.METRICOOL_USER_ID && process.env.METRICOOL_BLOG_ID),
    persistentStorage: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    videoRenderer: Boolean(process.env.VIDEO_RENDER_WEBHOOK_URL),
    cronSecret: Boolean(process.env.CRON_SECRET),
    appUrlHttps: (process.env.APP_URL || '').startsWith('https://'),
    autopilotEnabled: process.env.AUTOPILOT_ENABLED === 'true',
  }

  const required = ['openai','metricool','persistentStorage','videoRenderer','cronSecret','appUrlHttps'] as const
  const missing = required.filter((key) => !checks[key])
  const safeToEnable = missing.length === 0

  return Response.json({
    ok: safeToEnable,
    safeToEnableAutopilot: safeToEnable,
    checks,
    missing,
    recommendation: safeToEnable
      ? 'Run the end-to-end dry run before enabling autonomous publishing.'
      : 'Keep AUTOPILOT_ENABLED=false until every required check passes.',
  }, { status: safeToEnable ? 200 : 503 })
}
