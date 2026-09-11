import { NextRequest } from 'next/server'
import { normalizeAudienceSignal, saveAudienceSignal } from '@/lib/audience'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = process.env.AUDIENCE_INGEST_SECRET || process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await req.json()
    const inputs = Array.isArray(body.signals) ? body.signals : [body]
    if (inputs.length > 500) return Response.json({ ok: false, error: 'Maximum 500 signals per request.' }, { status: 400 })
    let imported = 0
    for (const input of inputs) {
      const signal = normalizeAudienceSignal(input)
      if (!signal.text) continue
      await saveAudienceSignal(signal)
      imported++
    }
    return Response.json({ ok: true, imported })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Audience ingestion failed.' }, { status: 500 })
  }
}
