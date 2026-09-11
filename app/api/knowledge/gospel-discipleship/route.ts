import { NextRequest, NextResponse } from 'next/server'
import { reviewGospelDiscipleship, saveGospelDiscipleship, validateGospelDiscipleship } from '@/lib/gospel-discipleship'
export async function POST(req: NextRequest) {
  const secret = process.env.AUTOPILOT_SECRET
  if (secret && req.headers.get('x-autopilot-secret') !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { const review = await reviewGospelDiscipleship(await req.json()); const validation=validateGospelDiscipleship(review); if(validation.ok) await saveGospelDiscipleship(review); return NextResponse.json({review,validation}) } catch(error){ return NextResponse.json({error:error instanceof Error?error.message:'Review failed'},{status:500}) }
}
