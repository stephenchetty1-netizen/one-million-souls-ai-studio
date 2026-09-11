import { NextRequest, NextResponse } from 'next/server';
import { getNextContentDecision } from '@/lib/decision-agent';
import { reviewBiblicalContext } from '@/lib/biblical-context';
import { saveBiblicalContext } from '@/lib/biblical-context';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const decision = await getNextContentDecision();
    if (!decision?.topic) return NextResponse.json({ ok: false, status: 'WAIT_FOR_DATA' });
    const review = await reviewBiblicalContext({ reference: 'decision-topic', intendedClaim: decision.topic });
    await saveBiblicalContext(review);
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Context cron failed' }, { status: 500 });
  }
}
