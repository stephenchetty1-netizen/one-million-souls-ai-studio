import { NextRequest, NextResponse } from 'next/server'
import { reviewApologetics, saveApologetics, validateApologetics } from '@/lib/apologetics'
export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try { const review = await reviewApologetics(await req.json()); const validation = validateApologetics(review); if (validation.ok) await saveApologetics(review); return NextResponse.json({ ok: validation.ok, review, validation }) }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Apologetics review failed' }, { status: 500 }) }
}
