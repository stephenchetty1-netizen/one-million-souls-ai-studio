import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const baseUrl = process.env.APP_URL || req.nextUrl.origin
  const response = await fetch(`${baseUrl}/api/audience/profile`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.AUDIENCE_INGEST_SECRET || secret}` }, cache: 'no-store'
  })
  const body = await response.json()
  return Response.json(body, { status: response.status })
}
