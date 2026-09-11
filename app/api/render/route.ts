import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401})
  const url = process.env.VIDEO_RENDER_WEBHOOK_URL
  if (!url) return NextResponse.json({ok:false,error:'VIDEO_RENDER_WEBHOOK_URL is not configured.'},{status:503})
  try {
    const body = await req.json()
    const response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(process.env.VIDEO_RENDER_SECRET?{Authorization:`Bearer ${process.env.VIDEO_RENDER_SECRET}`}:{})},body:JSON.stringify(body),cache:'no-store'})
    const data=await response.json().catch(()=>({}))
    if(!response.ok || typeof data.mediaUrl!=='string' || !/^https:\/\//.test(data.mediaUrl)) return NextResponse.json({ok:false,error:'Renderer did not return a valid HTTPS mediaUrl.',provider:data},{status:502})
    return NextResponse.json({ok:true,...data})
  } catch(e){ return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Render failed.'},{status:502}) }
}
