import { NextResponse } from 'next/server'
import { reviewBiblicalDoctrine, saveBiblicalDoctrine, validateBiblicalDoctrine } from '@/lib/biblical-doctrine'

export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.AUTOPILOT_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const review = await reviewBiblicalDoctrine(body)
    const validation = validateBiblicalDoctrine(review)
    if (!validation.ok) return NextResponse.json({ ok: false, review, validation }, { status: 422 })
    await saveBiblicalDoctrine(review)
    return NextResponse.json({ ok: true, review, validation })
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Doctrine review failed.' }, { status: 500 }) }
}
