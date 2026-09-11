import { NextRequest, NextResponse } from 'next/server'
import { reviewGospelDiscipleship, saveGospelDiscipleship, validateGospelDiscipleship } from '@/lib/gospel-discipleship'
export async function GET(req: NextRequest) {
  const secret=process.env.AUTOPILOT_SECRET; if(secret && req.headers.get('x-autopilot-secret')!==secret) return NextResponse.json({error:'Unauthorized'},{status:401})
  try { const review=await reviewGospelDiscipleship({reference:process.env.BIBLE_REVIEW_REFERENCE||'John 15:1-17',intendedClaim:'Followers of Jesus are called to abide in him, bear fruit, love one another, and participate in his mission.'}); const validation=validateGospelDiscipleship(review); if(validation.ok) await saveGospelDiscipleship(review); return NextResponse.json({review,validation}) } catch(error){ return NextResponse.json({error:error instanceof Error?error.message:'Cron review failed'},{status:500}) }
}
