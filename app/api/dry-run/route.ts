import { NextRequest } from 'next/server'

function authorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  return Boolean(expected && req.headers.get('authorization') === `Bearer ${expected}`)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const base = process.env.APP_URL
  const required = ['OPENAI_API_KEY', 'APP_URL', 'VIDEO_RENDER_WEBHOOK_URL', 'CRON_SECRET']
  const missing = required.filter((k) => !process.env[k])
  if (missing.length || !base?.startsWith('https://')) {
    return Response.json({ ok: false, stage: 'config', missing, appUrlHttps: base?.startsWith('https://') ?? false }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const topic = typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : 'God is faithful when you are waiting'
  const generateUrl = `${base.replace(/\/$/, '')}/api/generate`

  const generated = await fetch(generateUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.CRON_SECRET}` },
    body: JSON.stringify({ topic, dryRun: true }),
    cache: 'no-store'
  })
  const campaign = await generated.json().catch(() => ({}))
  if (!generated.ok) return Response.json({ ok: false, stage: 'generate', status: generated.status, campaign }, { status: 502 })

  const qualityPass = campaign?.quality?.status === 'PASS'
  if (!qualityPass) return Response.json({ ok: false, stage: 'quality', campaign }, { status: 422 })

  const renderer = await fetch(process.env.VIDEO_RENDER_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(process.env.VIDEO_RENDER_SECRET ? { authorization: `Bearer ${process.env.VIDEO_RENDER_SECRET}` } : {}) },
    body: JSON.stringify({ campaign, dryRun: true }),
    cache: 'no-store'
  })
  const renderResult = await renderer.json().catch(() => ({}))
  if (!renderer.ok || typeof renderResult?.mediaUrl !== 'string' || !renderResult.mediaUrl.startsWith('https://')) {
    return Response.json({ ok: false, stage: 'render', status: renderer.status, renderResult }, { status: 502 })
  }

  return Response.json({
    ok: true,
    dryRun: true,
    published: false,
    scheduled: false,
    topic,
    quality: campaign.quality,
    mediaUrl: renderResult.mediaUrl,
    next: 'Review the rendered asset, then test Metricool scheduling separately before enabling autopilot.'
  })
}
