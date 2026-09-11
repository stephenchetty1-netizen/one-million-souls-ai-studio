import { NextResponse } from 'next/server'
import { buildMissionStrategy, saveMissionStrategy } from '@/lib/mission-strategist'

export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const strategy = await buildMissionStrategy()
    await saveMissionStrategy(strategy)
    return NextResponse.json({ ok: true, strategy })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Mission strategy failed.' }, { status: 500 })
  }
}
