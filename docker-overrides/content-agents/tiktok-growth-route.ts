import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { runTikTokGrowthScan, TIKTOK_GROWTH_BOTS, inspectTikTokCaption } from '../../../../content-agents/tiktok-growth-swarm.mjs'
import { loadTikTokGrowthState, recordTikTokExperiment } from '../../../../content-agents/tiktok-growth-memory.mjs'
import { loadGrowthMultiplierState } from '../../../../content-agents/growth-multiplier-memory.mjs'

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
  let baseline:any={}
  try{config=JSON.parse(await fs.readFile(path.join(process.cwd(),'content-agents','tiktok-growth-config.json'),'utf8'))}catch{}
  try{baseline=JSON.parse(await fs.readFile(path.join(process.cwd(),'content-agents','tiktok-growth-baseline.json'),'utf8'))}catch{}
  const state=await loadTikTokGrowthState()
  const multiplier=await loadGrowthMultiplierState()
  return NextResponse.json({
    ok:true,
    system:'tiktok-growth-swarm',
    zeroCreditOnly:process.env.ZERO_CREDIT_ONLY==='true',
    intervalHours:Number(process.env.TIKTOK_GROWTH_INTERVAL_HOURS||6),
    bots:TIKTOK_GROWTH_BOTS,
    baseline,
    memory:{
      updatedAt:state.updatedAt,
      recentTopics:(state.recentTopics||[]).slice(0,12),
      latestRecommendations:state.latestRecommendations||[],
      metricSnapshots:(state.metricsHistory||[]).length,
      experiments:(state.experiments||[]).slice(0,12),
      persistenceWarning:state.persistenceWarning||null,
    },
    growthMultiplier:{winnersStored:(multiplier.winners||[]).length,rescuesStored:(multiplier.rescues||[]).length,retiredStored:(multiplier.retired||[]).length,persistenceWarning:multiplier.persistenceWarning||null},
    config,
  })
}

export async function POST(req:Request){
  if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const body=await req.json().catch(()=>({}))
  try{
    if(body?.action==='record-experiment'){
      const result=await recordTikTokExperiment(body?.experiment||{})
      return NextResponse.json({ok:true,zeroCreditOnly:true,experiment:result.experiments?.[0]||null})
    }
    if(body?.action==='inspect-caption'){
      return NextResponse.json({
        ok:true,
        zeroCreditOnly:true,
        inspection:inspectTikTokCaption(String(body?.caption||''),Array.isArray(body?.recentCaptions)?body.recentCaptions:[])
      })
    }
    const result=await runTikTokGrowthScan({
      topics:Array.isArray(body?.topics)?body.topics:undefined,
      metrics:body?.metrics&&typeof body.metrics==='object'?body.metrics:undefined,
      recentCaptions:Array.isArray(body?.recentCaptions)?body.recentCaptions:undefined,
      caption:typeof body?.caption==='string'?body.caption:undefined,
      performanceRecords:Array.isArray(body?.performanceRecords)?body.performanceRecords:undefined,
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
