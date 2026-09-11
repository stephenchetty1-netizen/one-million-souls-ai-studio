import { NextRequest, NextResponse } from 'next/server'
import { generateVoiceOnly } from '@/lib/creative-asset-engine'
export const runtime='nodejs'
export async function POST(req:NextRequest){
  const secret=process.env.CRON_SECRET
  if(!secret || req.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401})
  try{
    const body=await req.json()
    const plan={scenes:Array.isArray(body?.scenes)?body.scenes:[],coverConcept:''}
    const voice=await generateVoiceOnly(plan.scenes)
    return NextResponse.json({ok:true,voice,provider:process.env.CREATIVE_ASSETS_ENABLED==='true'?'openai-gpt-4o-mini-tts':'external-renderer'})
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Voice generation failed.'},{status:500})}
}
