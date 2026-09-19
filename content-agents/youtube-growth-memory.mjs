import { durableRedis } from './durable-redis.mjs'

const KEY='one-million-souls:youtube-growth:state:v2'
const MAX_TOPICS=60
const MAX_METRICS=90
const MAX_EXPERIMENTS=40

function safeJson(value,fallback){
  try{return value?JSON.parse(value):fallback}catch{return fallback}
}
function now(){return new Date().toISOString()}
function uniqRecent(items,limit){
  const out=[]
  const seen=new Set()
  for(const item of items){
    const key=String(item?.key||item?.topic||item?.title||JSON.stringify(item))
    if(seen.has(key))continue
    seen.add(key);out.push(item)
    if(out.length>=limit)break
  }
  return out
}
export function emptyGrowthState(){
  return {
    version:2,
    updatedAt:null,
    recentTopics:[],
    metricsHistory:[],
    experiments:[],
    latestScan:null,
    latestRecommendations:[],
  }
}
export async function loadYoutubeGrowthState(){
  try{
    const raw=await durableRedis(['GET',KEY])
    return {...emptyGrowthState(),...safeJson(raw,{})}
  }catch(error){
    return {...emptyGrowthState(),persistenceWarning:error instanceof Error?error.message:String(error)}
  }
}
export async function saveYoutubeGrowthState(state){
  const next={...emptyGrowthState(),...state,updatedAt:now()}
  await durableRedis(['SET',KEY,JSON.stringify(next)])
  return next
}
export async function rememberYoutubeGrowthScan(scan,metrics={}){
  const state=await loadYoutubeGrowthState()
  const topics=(scan?.opportunities||[]).map(x=>({
    key:String(x.topic||'').toLowerCase(),
    topic:x.topic,
    opportunityScore:x.opportunityScore??null,
    at:scan.searchedAt||now(),
  })).filter(x=>x.key)
  const snapshot={
    at:now(),
    views:Number(metrics.views||metrics.videoViews||0),
    uploads:Number(metrics.uploads||0),
    subscribers:Number(metrics.subscribers||metrics.latestObservedSubscribers||0),
    subscribersGained:Number(metrics.subscribersGained||0),
    subscribersLost:Number(metrics.subscribersLost||0),
    watchMinutes:Number(metrics.watchMinutes||0),
    averageViewDuration:Number(metrics.averageViewDuration||0),
    ctr:Number(metrics.ctr||0),
    introRetention30s:Number(metrics.introRetention30s||0),
    averagePercentageViewed:Number(metrics.averagePercentageViewed||0),
  }
  const hasMetric=Object.entries(snapshot).some(([k,v])=>k!=='at'&&Number(v)>0)
  const next={
    ...state,
    latestScan:scan,
    recentTopics:uniqRecent([...topics,...(state.recentTopics||[])],MAX_TOPICS),
    metricsHistory:hasMetric?[snapshot,...(state.metricsHistory||[])].slice(0,MAX_METRICS):(state.metricsHistory||[]),
    latestRecommendations:[
      ...(scan?.retention||[]),
      ...(scan?.subscriberGrowth?.actions||[]),
    ].slice(0,12),
  }
  try{return await saveYoutubeGrowthState(next)}
  catch(error){return {...next,persistenceWarning:error instanceof Error?error.message:String(error)}}
}
export async function recordYoutubeExperiment(experiment){
  const state=await loadYoutubeGrowthState()
  const entry={
    id:String(experiment?.id||`exp-${Date.now()}`),
    createdAt:experiment?.createdAt||now(),
    status:String(experiment?.status||'PLANNED'),
    variable:String(experiment?.variable||''),
    hypothesis:String(experiment?.hypothesis||''),
    baseline:experiment?.baseline||null,
    result:experiment?.result||null,
    decision:experiment?.decision||'PENDING',
  }
  state.experiments=[entry,...(state.experiments||[])].slice(0,MAX_EXPERIMENTS)
  return saveYoutubeGrowthState(state)
}
