import { NextResponse } from 'next/server'
import { reviewChristCenteredGospel, saveChristCenteredGospel, validateChristCenteredGospel } from '@/lib/christ-centered-gospel'

export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.AUTOPILOT_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const review = await reviewChristCenteredGospel(body)
    const validation = validateChristCenteredGospel(review)
    if (!validation.ok) return NextResponse.json({ ok: false, review, validation }, { status: 422 })
    await saveChristCenteredGospel(review)
    return NextResponse.json({ ok: true, review, validation })
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gospel review failed.' }, { status: 500 }) }
}
