import { NextRequest, NextResponse } from 'next/server'
import { reviewEvangelismMission, saveEvangelismMission, validateEvangelismMission } from '@/lib/evangelism-mission'

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const review = await reviewEvangelismMission(await req.json())
    const validation = validateEvangelismMission(review)
    if (validation.ok) await saveEvangelismMission(review)
    return NextResponse.json({ ok: validation.ok, review, validation })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Evangelism & mission review failed' }, { status: 500 })
  }
}
