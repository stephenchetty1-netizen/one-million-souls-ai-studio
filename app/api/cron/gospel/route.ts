import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.AUTOPILOT_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ ok: false, status: 'WAITING_FOR_DEPENDENCIES', detail: 'Use the main orchestration flow for V45 interpretation → Gospel sequencing.' }, { status: 200 })
}
