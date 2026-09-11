import { NextRequest } from 'next/server'
import { buildProgrammingCalendar, saveProgrammingCalendar, validateProgrammingCalendar } from '@/lib/programming-director'
export const runtime = 'nodejs'
function authorized(req: NextRequest) { const secret = process.env.CRON_SECRET; return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`) }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const calendar = await buildProgrammingCalendar()
    if (!validateProgrammingCalendar(calendar)) return Response.json({ ok: false, error: 'Programming calendar failed validation.' }, { status: 422 })
    await saveProgrammingCalendar(calendar)
    return Response.json({ ok: true, calendar })
  } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Programming calendar failed.' }, { status: 500 }) }
}
export const GET = POST
