import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401})
  return NextResponse.json({ok:true,mode:'external-renderer',message:'Voice generation is delegated to the configured renderer; no voice file is fabricated by this API.'})
}
