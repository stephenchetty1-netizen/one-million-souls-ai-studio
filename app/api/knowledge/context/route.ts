import { NextRequest, NextResponse } from 'next/server';
import { reviewBiblicalContext, validateBiblicalContext } from '@/lib/biblical-context';

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const review = await reviewBiblicalContext(body);
    return NextResponse.json({ ok: validateBiblicalContext(review).ok, review, validation: validateBiblicalContext(review) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Context review failed' }, { status: 500 });
  }
}
