import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { runYoutubeGrowthScan, YOUTUBE_GROWTH_BOTS } from '../../../../content-agents/youtube-growth-swarm.mjs'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function authorized(req:Request){
  const secret=process.env.CRON_SECRET||''
  if(!secret)return false
  return req.headers.get('authorization')===`Bearer ${secret}`
}

export async function GET(req:Request){
  if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  let config:any={}
  try{
    config=JSON.parse(await fs.readFile(path.join(process.cwd(),'content-agents','youtube-growth-config.json'),'utf8'))
  }catch{}
  return NextResponse.json({
    ok:true,
    system:'youtube-growth-swarm',
    zeroCreditOnly:process.env.ZERO_CREDIT_ONLY==='true',
    publicSearchConfigured:Boolean(process.env.YOUTUBE_API_KEY),
    channelConfigured:Boolean(process.env.YOUTUBE_CHANNEL_ID),
    intervalHours:Number(process.env.YOUTUBE_GROWTH_INTERVAL_HOURS||6),
    bots:YOUTUBE_GROWTH_BOTS,
    config,
  })
}

export async function POST(req:Request){
  if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const body=await req.json().catch(()=>({}))
  try{
    const result=await runYoutubeGrowthScan({
      topics:Array.isArray(body?.topics)?body.topics:undefined,
      metrics:body?.metrics&&typeof body.metrics==='object'?body.metrics:undefined,
      days:Number(body?.days||120),
      maxResults:Number(body?.maxResults||8),
    })
    return NextResponse.json(result)
  }catch(error){
    return NextResponse.json({
      ok:false,
      blocked:true,
      zeroCreditOnly:true,
      error:error instanceof Error?error.message:String(error),
    },{status:409})
  }
}
