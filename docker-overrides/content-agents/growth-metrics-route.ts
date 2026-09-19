import { NextResponse } from 'next/server'
import { ingestVerifiedPerformance, loadVerifiedPerformance } from '../../../../content-agents/verified-performance-evidence.mjs'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function authorized(req:Request){
  const secret=process.env.CRON_SECRET||''
  return Boolean(secret)&&req.headers.get('authorization')===`Bearer ${secret}`
}
export async function GET(req:Request){
  if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const [youtube,tiktok]=await Promise.all([
    loadVerifiedPerformance('youtube'),loadVerifiedPerformance('tiktok')
  ])
  const summarize=(s:any)=>({
    platform:s.platform,source:s.source||null,transport:s.transport,
    capturedAt:s.capturedAt, freshness:s.freshness,
    postCount:s.postCount,measuredPostCount:s.measuredPostCount,
    metricsComplete:s.metricsComplete,autonomousUpstreamConfigured:s.autonomousUpstreamConfigured,
    warning:s.warning||s.persistenceWarning||null,
  })
  return NextResponse.json({
    ok:true,zeroCreditOnly:process.env.ZERO_CREDIT_ONLY==='true',
    ingestRequiresAuthentication:true,
    publishingAuthority:false,
    youtube:summarize(youtube),tiktok:summarize(tiktok)
  })
}
export async function POST(req:Request){
  if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  if(Number(req.headers.get('content-length')||0)>128000){
    return NextResponse.json({ok:false,error:'Payload too large'},{status:413})
  }
  const raw=await req.text()
  if(raw.length>128000)return NextResponse.json({ok:false,error:'Payload too large'},{status:413})
  let data:any
  try{data=JSON.parse(raw)}catch{return NextResponse.json({ok:false,error:'Invalid JSON'},{status:400})}
  try{
    const accepted=await ingestVerifiedPerformance(data)
    return NextResponse.json({ok:true,zeroCreditOnly:true,publishingAuthority:false,...accepted})
  }catch(error){
    return NextResponse.json({ok:false,error:String((error as Error)?.message||error)}, {status:409})
  }
}
