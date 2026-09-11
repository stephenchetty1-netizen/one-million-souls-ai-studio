import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const baseUrl = process.env.APP_URL || req.nextUrl.origin
  let sync = { configured: false, imported: 0 }

  if (process.env.METRICOOL_ANALYTICS_ADAPTER_URL) {
    const syncResponse = await fetch(process.env.METRICOOL_ANALYTICS_ADAPTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.METRICOOL_ANALYTICS_ADAPTER_SECRET ? { Authorization: `Bearer ${process.env.METRICOOL_ANALYTICS_ADAPTER_SECRET}` } : {}),
      },
      body: JSON.stringify({ campaign: 'One Million Souls', timezone: process.env.APP_TIMEZONE || 'Africa/Johannesburg' }),
      cache: 'no-store',
    })
    const adapter = await syncResponse.json()
    if (!syncResponse.ok || !Array.isArray(adapter.records)) {
      return Response.json({ ok: false, error: adapter.error || 'Metricool analytics adapter failed.', sync: { configured: true, imported: 0 } }, { status: 502 })
    }
    const ingestResponse = await fetch(`${baseUrl}/api/analytics/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ANALYTICS_INGEST_SECRET || secret}` },
      body: JSON.stringify({ records: adapter.records }),
      cache: 'no-store',
    })
    const ingested = await ingestResponse.json()
    if (!ingestResponse.ok) return Response.json({ ok: false, error: ingested.error || 'Analytics ingestion failed.', sync: { configured: true, imported: 0 } }, { status: 502 })
    sync = { configured: true, imported: Number(ingested.imported || 0) }
  }

  const audienceResponse = await fetch(`${baseUrl}/api/audience/profile`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.AUDIENCE_INGEST_SECRET || secret}` },
    cache: 'no-store',
  })
  const audience = await audienceResponse.json()

  const response = await fetch(`${baseUrl}/api/growth`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.ANALYTICS_INGEST_SECRET || secret}` },
    cache: 'no-store',
  })
  const body = await response.json()
  return Response.json({ ...body, audience, sync }, { status: response.status })
}

export const GET = POST
