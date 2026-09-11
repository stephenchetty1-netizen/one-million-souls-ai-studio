import { NextRequest, NextResponse } from 'next/server'
import { reviewScriptureHermeneutics, validateScriptureHermeneutics } from '@/lib/scripture-hermeneutics'
import { redisSetJson } from '@/lib/jobs'

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const review = await reviewScriptureHermeneutics(body)
    const validation = validateScriptureHermeneutics(review)
    if (validation.ok) await redisSetJson('one-million-souls:knowledge:scripture-hermeneutics:latest', review, 60 * 60 * 24 * 30)
    return NextResponse.json({ ok: validation.ok, review, validation })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Hermeneutics review failed' }, { status: 500 })
  }
}
