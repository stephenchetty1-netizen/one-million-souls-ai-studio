import { NextRequest, NextResponse } from 'next/server'
import { interpretScripture, validateScriptureInterpretation } from '@/lib/scripture-interpretation'
export async function POST(req:NextRequest){
  if(req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  try { const body=await req.json(); const review=await interpretScripture(body); const validation=validateScriptureInterpretation(review); return NextResponse.json({ok:validation.ok,review,validation}) }
  catch(e){ return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Interpretation failed'},{status:500}) }
}
