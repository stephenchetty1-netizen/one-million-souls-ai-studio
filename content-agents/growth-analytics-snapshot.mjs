import { durableRedis } from './durable-redis.mjs'

const PREFIX='one-million-souls:v59:analytics-snapshot:v1:'
const PLATFORMS=new Set(['youtube','tiktok'])
const MAX_AGE_MS=48*60*60*1000

const number=(value)=>{
  if(value===null||value===undefined||value==='')return null
  const v=Number(value)
  return Number.isFinite(v)&&v>=0?v:null
}
function sanitizeRecord(platform,item){
  if(!item||typeof item!=='object')return null
  const raw=String(item.postId||item.videoId||item.id||item.url||'').slice(0,240)
  if(!raw)return null
  const durationSeconds=number(item.durationSeconds)
  const averageWatchSeconds=number(item.averageWatchSeconds)
  const fields=['views','likes','comments','shares','subscribersGained','subscribersLost','followersAcquired','followersLost','interactions','averagePercentageViewed']
  const out={
    postId:raw,title:String(item.title||item.topic||'').slice(0,240),
    topic:String(item.topic||item.title||'').slice(0,240),
    publishedAt:String(item.publishedAt||'').slice(0,40),
    durationSeconds,averageWatchSeconds,
  }
  for(const field of fields)out[field]=number(item[field])
  const valid=number(out.views)!==null
  return valid?out:null
}
export function normalizeAnalyticsSnapshot(payload,at=new Date()){
  if(!payload||typeof payload!=='object')throw new Error('ANALYTICS_PAYLOAD_REQUIRED')
  const platform=String(payload.platform||'').toLowerCase()
  if(!PLATFORMS.has(platform))throw new Error('ANALYTICS_PLATFORM_INVALID')
  if(payload.source!=='METRICOOL_CONNECTED_ACCOUNT')throw new Error('ANALYTICS_SOURCE_INVALID')
  const capturedMs=Date.parse(payload.capturedAt||'')
  if(!Number.isFinite(capturedMs)||capturedMs>at.getTime()+5*60*1000)throw new Error('ANALYTICS_CAPTURE_TIMESTAMP_INVALID')
  if(at.getTime()-capturedMs>MAX_AGE_MS)throw new Error('ANALYTICS_SNAPSHOT_TOO_OLD')
  const metrics=payload.metrics
  if(!metrics||typeof metrics!=='object')throw new Error('ANALYTICS_METRICS_REQUIRED')
  const cleanMetrics={}
  for(const field of ['views','videoViews','videos','uploads','subscribers','subscribersGained','subscribersLost','followers','followersAcquired','followersLost','likes','comments','shares','interactions','averageViewDuration','averagePercentageViewed','ctr','introRetention30s','profileViews','watchMinutes']){
    const v=number(metrics[field]);if(v!==null)cleanMetrics[field]=v
  }
  if(!Number.isFinite(cleanMetrics.views??cleanMetrics.videoViews))throw new Error('ANALYTICS_VIEWS_REQUIRED')
  const records=Array.isArray(payload.records)?payload.records.slice(0,60).map(x=>sanitizeRecord(platform,x)).filter(Boolean):[]
  return {
    version:1,
    source:'METRICOOL_CONNECTED_ACCOUNT',
    transport:String(payload.transport||'CHATGPT_METRICOOL_SYNC').slice(0,64),
    platform,capturedAt:new Date(capturedMs).toISOString(),
    rangeStart:String(payload.rangeStart||'').slice(0,40),
    rangeEnd:String(payload.rangeEnd||'').slice(0,40),
    metrics:cleanMetrics,records,
    readOnly:true,
    freshnessMode:'MANUAL_CONNECTOR_SYNC',
    publishingAuthority:false,
  }
}
export async function saveAnalyticsSnapshot(payload){
  const snapshot=normalizeAnalyticsSnapshot(payload)
  const key=PREFIX+snapshot.platform
  const oldRaw=await durableRedis(['GET',key])
  if(oldRaw){
    try{const previous=JSON.parse(oldRaw)
      if(Date.parse(previous.capturedAt)>=Date.parse(snapshot.capturedAt)){
        return {stored:false,reason:'DUPLICATE_OR_OLDER_SNAPSHOT',platform:snapshot.platform,capturedAt:previous.capturedAt}
      }
    }catch{}
  }
  const result=await durableRedis(['SET',key,JSON.stringify(snapshot)])
  if(result!=='OK')throw new Error('ANALYTICS_REDIS_WRITE_FAILED')
  return {stored:true,platform:snapshot.platform,capturedAt:snapshot.capturedAt,records:snapshot.records.length}
}
export async function loadAnalyticsSnapshot(platform){
  if(!PLATFORMS.has(platform))throw new Error('ANALYTICS_PLATFORM_INVALID')
  const raw=await durableRedis(['GET',PREFIX+platform])
  if(!raw)return {available:false,platform,reason:'ANALYTICS_SNAPSHOT_MISSING'}
  let snapshot
  try{snapshot=JSON.parse(raw)}catch{return {available:false,platform,reason:'ANALYTICS_SNAPSHOT_CORRUPT'}}
  const ageMs=Date.now()-Date.parse(snapshot.capturedAt)
  if(!Number.isFinite(ageMs)||ageMs>MAX_AGE_MS||ageMs< -5*60*1000){
    return {available:false,platform,reason:'ANALYTICS_SNAPSHOT_STALE',capturedAt:snapshot.capturedAt}
  }
  return {available:true,...snapshot,ageMinutes:Math.round(ageMs/60000)}
}
export async function bootstrapAnalyticsSnapshotEnv(){
  const raw=process.env.METRICOOL_ANALYTICS_BOOTSTRAP_JSON
  if(!raw)return {ok:true,skipped:true,reason:'NO_BOOTSTRAP_SNAPSHOT'}
  let parsed
  try{parsed=JSON.parse(raw)}catch{return {ok:false,reason:'BOOTSTRAP_JSON_INVALID'}}
  const items=Array.isArray(parsed)?parsed:[parsed]
  const result=[]
  for(const payload of items){
    try{result.push(await saveAnalyticsSnapshot(payload))}
    catch(error){result.push({stored:false,error:String(error?.message||error)})}
  }
  return {ok:result.every(x=>!x.error),results:result}
}
