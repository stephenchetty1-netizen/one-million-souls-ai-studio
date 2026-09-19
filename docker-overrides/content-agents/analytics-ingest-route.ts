import { NextResponse } from 'next/server'
import { loadAnalyticsSnapshot, saveAnalyticsSnapshot } from '../../../../content-agents/growth-analytics-snapshot.mjs'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function authorized(req:Request){
  const secret=process.env.CRON_SECRET||''
  return Boolean(secret)&&req.headers.get('authorization')===`Bearer ${secret}`
}
export async function GET(req:Request){
  if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const [youtube,tiktok]=await Promise.all(['youtube','tiktok'].map(loadAnalyticsSnapshot))
  return NextResponse.json({
    ok:true,zeroCreditOnly:process.env.ZERO_CREDIT_ONLY==='true',publishingAuthority:false,
    platforms:[youtube,tiktok].map(p=>({
      platform:p.platform,available:p.available,
      capturedAt:p.capturedAt||null,ageMinutes:p.ageMinutes??null,
      records:p.records?.length||0,
      freshnessMode:p.freshnessMode||null,reason:p.reason||null
    }))
  })
}
export async function POST(req:Request){
  if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  if(process.env.ZERO_CREDIT_ONLY!=='true')return NextResponse.json({ok:false,error:'ZERO_CREDIT_ONLY_REQUIRED'},{status:409})
  const body=await req.json().catch(()=>null)
  if(!body)return NextResponse.json({ok:false,error:'INVALID_JSON'},{status:400})
  try{
    const result=await saveAnalyticsSnapshot(body)
    return NextResponse.json({ok:true,zeroCreditOnly:true,publishingAuthority:false,...result})
  }catch(error){
    return NextResponse.json({ok:false,error:String(error?.message||error)},{status:400})
  }
}
