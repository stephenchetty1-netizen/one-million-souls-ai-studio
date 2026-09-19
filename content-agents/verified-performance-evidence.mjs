import fs from 'node:fs/promises'
import path from 'node:path'
import { durableRedis } from './durable-redis.mjs'
import { loadAnalyticsSnapshot } from './growth-analytics-snapshot.mjs'

const PREFIX='one-million-souls:v59:verified-performance:v1:'
const PLATFORMS=new Set(['youtube','tiktok'])
const SOURCES=new Set(['CONNECTED_METRICOOL','OWNER_YOUTUBE_ANALYTICS','OWNER_TIKTOK_ANALYTICS'])
const MAX_ROWS=60
const NUMERIC_FIELDS=[
  'views','durationSeconds','averageWatchSeconds','likes','comments','shares',
  'interactions','subscribersGained','subscribersLost','followersAcquired',
  'followersLost','averagePercentageViewed','fullWatchRate','searchViewShare'
]
function err(name){throw new Error(name)}
function validDate(value){
  const ms=Date.parse(String(value||''))
  if(!Number.isFinite(ms)||ms>Date.now()+5*60*1000||ms<Date.now()-45*86400000)err('INVALID_ANALYTICS_CAPTURE_TIME')
  return new Date(ms).toISOString()
}
function validCount(value,field){
  if(value===null||value===undefined||value==='')return null
  const n=Number(value)
  if(!Number.isFinite(n)||n<0||n>1000000000000)err('INVALID_METRIC_'+field.toUpperCase())
  return n
}
function normalizeRecord(raw,platform){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))err('INVALID_ANALYTICS_RECORD')
  let postId=String(raw.postId||raw.videoId||raw.id||'').trim()
  if(postId.startsWith('http')){
    const match=postId.match(/(?:\/video\/|[?&]v=)([A-Za-z0-9_-]+)/)
    postId=match?.[1]||''
  }
  if(!postId||postId.length>100||!/^[A-Za-z0-9_-]+$/.test(postId))err('POST_ID_REQUIRED')
  const topic=String(raw.topic||raw.title||'').trim().slice(0,220)
  const result={postId,platform,topic}
  if(raw.publishedDate){
    const date=String(raw.publishedDate)
    if(!/^\d{4}-\d\d-\d\d$/.test(date))err('INVALID_PUBLISHED_DATE')
    result.publishedDate=date
  }
  for(const name of NUMERIC_FIELDS){
    const n=validCount(raw[name],name)
    if(n!==null)result[name]=n
  }
  return result
}
function normalize(snapshot){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))err('INVALID_ANALYTICS_SNAPSHOT')
  const platform=String(snapshot.platform||'').toLowerCase()
  if(!PLATFORMS.has(platform))err('INVALID_ANALYTICS_PLATFORM')
  const source=String(snapshot.source||'')
  if(!SOURCES.has(source))err('UNVERIFIED_ANALYTICS_SOURCE')
  const capturedAt=validDate(snapshot.capturedAt)
  if(!Array.isArray(snapshot.records)||snapshot.records.length>MAX_ROWS)err('INVALID_ANALYTICS_ROW_COUNT')
  const unique=new Map()
  for(const raw of snapshot.records){
    const row=normalizeRecord(raw,platform)
    if(unique.has(row.postId))err('DUPLICATE_ANALYTICS_POST_ID')
    unique.set(row.postId,row)
  }
  const channelMetrics={}
  for(const name of NUMERIC_FIELDS){
    const n=validCount(snapshot.channelMetrics?.[name],name)
    if(n!==null)channelMetrics[name]=n
  }
  return {
    platform,source,capturedAt,
    records:[...unique.values()],
    channelMetrics,
    measuredPostCount:[...unique.values()].filter(x=>Number.isFinite(x.views)).length,
    postCount:unique.size,
    metricsComplete:[...unique.values()].some(x=>Number.isFinite(x.views)),
    warning:typeof snapshot.warning==='string'?snapshot.warning.slice(0,300):null,
  }
}
async function readBootstrap(){
  try{
    return JSON.parse(await fs.readFile(path.join(process.cwd(),'content-agents','verified-metricool-bootstrap.json'),'utf8')).snapshots||{}
  }catch{return {}}
}
function freshness(s){
  if(!s)return {status:'UNAVAILABLE',ageHours:null}
  const age=(Date.now()-Date.parse(s.capturedAt))/3600000
  return {
    status:age<=24?'FRESH':age<=72?'AGING':'STALE',
    ageHours:Number(Math.max(0,age).toFixed(2)),
  }
}
export async function loadVerifiedPerformance(platform){
  if(!PLATFORMS.has(platform))err('INVALID_ANALYTICS_PLATFORM')
  const bootstrap=await readBootstrap()
  let seed=null
  try{if(bootstrap[platform])seed=normalize(bootstrap[platform])}catch{}
  let live=null,warning=null
  try{
    const stored=await durableRedis(['GET',PREFIX+platform])
    if(stored)live=normalize(JSON.parse(stored))
  }catch(error){warning=String(error?.message||error)}
  let existing=null
  try{
    const snapshot=await loadAnalyticsSnapshot(platform)
    if(snapshot.available){
      existing=normalize({
        platform,source:'CONNECTED_METRICOOL',capturedAt:snapshot.capturedAt,
        records:snapshot.records||[],channelMetrics:snapshot.metrics||{},
      })
    }
  }catch(error){
    warning=warning||String(error?.message||error)
  }
  const available=[seed,live,existing].filter(Boolean)
  const selected=available.sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt))[0]||null
  const result={
    platform,
    transport:selected===live?'DURABLE_VERIFIED_INGEST':selected===existing?'CONNECTED_METRICOOL_SNAPSHOT':selected?'DATED_BOOTSTRAP_FILE':'UNAVAILABLE',
    ...(selected||{capturedAt:null,records:[],channelMetrics:{},postCount:0,measuredPostCount:0,metricsComplete:false}),
    freshness:freshness(selected),
    autonomousUpstreamConfigured:false,
    persistenceWarning:warning,
  }
  return result
}
export async function ingestVerifiedPerformance(snapshot){
  if(process.env.ZERO_CREDIT_ONLY!=='true')err('ZERO_CREDIT_ONLY_REQUIRED')
  const clean=normalize(snapshot)
  const key=PREFIX+clean.platform
  const current=await loadVerifiedPerformance(clean.platform)
  if(current.capturedAt&&Date.parse(clean.capturedAt)<Date.parse(current.capturedAt))err('OLDER_ANALYTICS_SNAPSHOT_REJECTED')
  if(current.capturedAt===clean.capturedAt&&current.transport==='DURABLE_VERIFIED_INGEST')err('DUPLICATE_ANALYTICS_SNAPSHOT')
  await durableRedis(['SET',key,JSON.stringify(clean)])
  return {
    accepted:true,platform:clean.platform,capturedAt:clean.capturedAt,
    postCount:clean.postCount,measuredPostCount:clean.measuredPostCount,
    transport:'DURABLE_VERIFIED_INGEST',
  }
}
