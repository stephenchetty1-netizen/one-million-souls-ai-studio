import { z } from 'zod'
import { normalizePerformance, savePerformance } from '@/lib/learning'

const Payload = z.object({ records: z.array(z.unknown()).max(500) })

export async function POST(req: Request) {
  try {
    const secret = process.env.ANALYTICS_INGEST_SECRET || process.env.CRON_SECRET
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    const body = Payload.parse(await req.json())
    const records = body.records.map(normalizePerformance)
    for (const record of records) await savePerformance(record)
    return Response.json({ ok: true, imported: records.length })
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: 'Invalid analytics sync payload.' }, { status: 400 })
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Analytics sync failed.' }, { status: 500 })
  }
}
