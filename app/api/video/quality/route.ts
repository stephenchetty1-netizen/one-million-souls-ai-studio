import { NextRequest, NextResponse } from 'next/server'
import { validateRenderedVideo } from '@/lib/video-assembly'
export const runtime='nodejs'
export async function POST(req:NextRequest){
  const secret=process.env.CRON_SECRET
  if(!secret || req.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401})
  try{
    const body=await req.json()
    const checks={
      render:validateRenderedVideo(body?.rendered),
      scriptureIntegrity:body?.scriptureIntegrity===true,
      rights:body?.rightsCleared===true,
      captions:body?.captionsPresent===true,
      audio:body?.audioPresent===true,
      vertical:body?.vertical1080x1920===true,
    }
    const errors:string[]=[...checks.render.errors]
    for(const [name,value] of Object.entries(checks)) if(name!=='render' && value!==true) errors.push(`${name} check failed.`)
    return NextResponse.json({ok:errors.length===0,checks,errors},{status:errors.length===0?200:422})
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Video quality check failed.'},{status:500})}
}
