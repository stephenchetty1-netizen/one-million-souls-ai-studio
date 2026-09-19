import { durableRedis } from './durable-redis.mjs'

const KEY='one-million-souls:tiktok-growth:state:v1'
const MAX_TOPICS=60
const MAX_METRICS=90
const MAX_EXPERIMENTS=40

function safeJson(value,fallback){try{return value?JSON.parse(value):fallback}catch{return fallback}}
function now(){return new Date().toISOString()}
function uniqRecent(items,limit){
  const out=[]; const seen=new Set()
  for(const item of items){
    const key=String(item?.key||item?.topic||item?.title||JSON.stringify(item))
    if(seen.has(key))continue
    seen.add(key); out.push(item)
    if(out.length>=limit)break
  }
  return out
}
export function emptyTikTokGrowthState(){
  return {version:1,updatedAt:null,recentTopics:[],metricsHistory:[],experiments:[],latestScan:null,latestRecommendations:[]}
}
export async function loadTikTokGrowthState(){
  try{
    const raw=await durableRedis(['GET',KEY])
    return {...emptyTikTokGrowthState(),...safeJson(raw,{})}
  }catch(error){
    return {...emptyTikTokGrowthState(),persistenceWarning:error instanceof Error?error.message:String(error)}
  }
}
export async function saveTikTokGrowthState(state){
  const next={...emptyTikTokGrowthState(),...state,updatedAt:now()}
  await durableRedis(['SET',KEY,JSON.stringify(next)])
  return next
}
export async function rememberTikTokGrowthScan(scan,metrics={}){
  const state=await loadTikTokGrowthState()
  const topics=(scan?.opportunities||[]).map(x=>({
    key:String(x.topic||'').toLowerCase(),topic:x.topic,opportunityScore:x.opportunityScore??null,at:scan.scannedAt||now()
  })).filter(x=>x.key)
  const snapshot={
    at:now(),
    views:Number(metrics.views||0),
    videos:Number(metrics.videos||0),
    followers:Number(metrics.followers||0),
    followersAcquired:Number(metrics.followersAcquired||0),
    followersLost:Number(metrics.followersLost||0),
    likes:Number(metrics.likes||0),
    comments:Number(metrics.comments||0),
    shares:Number(metrics.shares||0),
    interactions:Number(metrics.interactions||0),
    profileViews:Number(metrics.profileViews||0),
    averageWatchSeconds:Number(metrics.averageWatchSeconds||0),
    fullWatchRate:Number(metrics.fullWatchRate||0),
  }
  const hasMetric=Object.entries(snapshot).some(([k,v])=>k!=='at'&&Number(v)>0)
  const next={
    ...state,
    latestScan:scan,
    recentTopics:uniqRecent([...topics,...(state.recentTopics||[])],MAX_TOPICS),
    metricsHistory:hasMetric?[snapshot,...(state.metricsHistory||[])].slice(0,MAX_METRICS):(state.metricsHistory||[]),
    latestRecommendations:[
      ...(scan?.retention||[]),
      ...(scan?.followerGrowth?.actions||[]),
    ].slice(0,12),
  }
  try{return await saveTikTokGrowthState(next)}
  catch(error){return {...next,persistenceWarning:error instanceof Error?error.message:String(error)}}
}
export async function recordTikTokExperiment(experiment){
  const state=await loadTikTokGrowthState()
  const entry={
    id:String(experiment?.id||`tt-exp-${Date.now()}`),
    createdAt:experiment?.createdAt||now(),
    status:String(experiment?.status||'PLANNED'),
    variable:String(experiment?.variable||''),
    hypothesis:String(experiment?.hypothesis||''),
    baseline:experiment?.baseline||null,
    result:experiment?.result||null,
    decision:experiment?.decision||'PENDING',
  }
  state.experiments=[entry,...(state.experiments||[])].slice(0,MAX_EXPERIMENTS)
  return saveTikTokGrowthState(state)
}
