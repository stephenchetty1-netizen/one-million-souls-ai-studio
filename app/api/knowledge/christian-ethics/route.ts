import { NextRequest, NextResponse } from 'next/server'
import { reviewChristianEthics, saveChristianEthics, validateChristianEthics } from '@/lib/christian-ethics'

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const review = await reviewChristianEthics(await req.json())
    const validation = validateChristianEthics(review)
    if (validation.ok) await saveChristianEthics(review)
    return NextResponse.json({ ok: validation.ok, review, validation })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Christian ethics review failed' }, { status: 500 })
  }
}
