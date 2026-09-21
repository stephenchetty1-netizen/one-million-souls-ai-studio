import { durableRedis } from '../content-agents/durable-redis.mjs'
import { runYoutubeGrowthScan } from '../content-agents/youtube-growth-swarm.mjs'
import { runTikTokGrowthScan } from '../content-agents/tiktok-growth-swarm.mjs'
import { loadAnalyticsSnapshot } from '../content-agents/growth-analytics-snapshot.mjs'
import { loadVerifiedPerformance } from '../content-agents/verified-performance-evidence.mjs'
import { refreshGrowthProvider } from '../content-agents/growth-provider-refresh.mjs'
import { saveRetentionExperimentPlan } from '../content-agents/v60-experiment-ledger.mjs'

const PREFIX='one-million-souls:v59:autonomous-growth:'
const LEASE_SECONDS=20*60
const RETRY_MS=30*60*1000
const YOUTUBE_STRATEGY_VERSION='V59_BIBLE_PLACES_TEST_20260921'
const BOT_DEFINITIONS=Object.freeze([
  {id:'youtube-growth-bot',platform:'youtube',hoursEnv:'YOUTUBE_GROWTH_INTERVAL_HOURS',run:runYoutubeGrowthScan},
  {id:'tiktok-growth-bot',platform:'tiktok',hoursEnv:'TIKTOK_GROWTH_INTERVAL_HOURS',run:runTikTokGrowthScan},
])

function period(bot){
  const hours=Number(process.env[bot.hoursEnv]||6)
  return Math.max(6,Number.isFinite(hours)?hours:6)*60*60*1000
}
function key(bot,suffix){return PREFIX+bot.id+':'+suffix}
function parse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
function errorText(err){return String(err?.message||err).slice(0,400)}
function when(ms){return new Date(ms).toISOString()}
function guard(){
  if(process.env.ZERO_CREDIT_ONLY!=='true')throw new Error('ZERO_CREDIT_ONLY_REQUIRED')
  if(process.env.YOUTUBE_GROWTH_ALLOW_PAID_AI==='true'||process.env.TIKTOK_GROWTH_ALLOW_PAID_AI==='true'||process.env.GROWTH_MULTIPLIER_ALLOW_PAID_AI==='true'){
    throw new Error('PAID_AI_BOT_DISABLED')
  }
}
function safeSummary(bot,result,snapshot){
  const queueErrors=Number(result?.growthMultiplier?.preProductionQueue?.failed||0)
  const ok=result?.ok===true&&result?.memory?.persistent===true&&result?.growthMultiplier?.memory?.persistent!==false&&queueErrors===0
  const researchMode=String(result?.researchMode||'UNKNOWN')
  const cached=/CACHED|OWNED_METRICS/.test(researchMode)
  return {
    status:ok?(cached?'DEGRADED':'READY'):'BLOCKED',
    researchMode,
    strategyVersion:bot.platform==='youtube'?YOUTUBE_STRATEGY_VERSION:null,
    growthObjectiveStatus:bot.platform==='youtube'
      ?result?.growthObjective?.progressStatus||'UNAVAILABLE':null,
    additionalSubscriberGoal:bot.platform==='youtube'
      ?Number(result?.growthObjective?.additionalGenuineSubscribers||0):null,
    additionalViewGoal:bot.platform==='youtube'
      ?Number(result?.growthObjective?.additionalAuthenticVideoViews||0):null,
    publicApiConfigured:bot.platform==='youtube'?result?.publicApiConfigured===true:null,
    publicApiWarning:bot.platform==='youtube'?result?.publicApiWarning||null:null,
    analyticsSnapshotAvailable:snapshot?.available===true,
    analyticsCapturedAt:snapshot?.available?snapshot.capturedAt:null,
    analyticsSnapshotWarning:snapshot?.available?null:(snapshot?.reason||'ANALYTICS_SNAPSHOT_MISSING'),
    performanceSource:result?.verifiedPerformance?.source||null,
    performanceTransport:result?.verifiedPerformance?.transport||'UNAVAILABLE',
    performanceCapturedAt:result?.verifiedPerformance?.capturedAt||null,
    performanceFreshness:result?.verifiedPerformance?.freshness?.status||'UNAVAILABLE',
    measuredPostCount:Number(result?.verifiedPerformance?.measuredPostCount||0),
    measuredRecordsUsed:Number(result?.verifiedPerformance?.measuredRecordsUsed||0),
    v60RetentionExperimentStatus:result?.v60RetentionExperimentPlan?.status||'UNAVAILABLE',
    v60RetentionExperimentProposals:Number(result?.v60RetentionExperimentPlan?.experiments?.length||0),
    v60HumanTemplateReviewRequired:result?.v60RetentionExperimentPlan?.experiments?.length>0,
    autonomousAnalyticsUpstreamConfigured:result?.verifiedPerformance?.autonomousUpstreamConfigured===true,
    measuredCurrentExternalResearch:ok&&!cached,
    topics:(result?.opportunities||[]).length,
    winners:(result?.growthMultiplier?.winners||[]).length,
    rescues:(result?.growthMultiplier?.rescues||[]).length,
    preProductionStaged:Number(result?.growthMultiplier?.preProductionQueue?.staged||0),
    preProductionErrors:Number(result?.growthMultiplier?.preProductionQueue?.failed||0),
    queuePersistence:result?.memory?.persistent===true,
    readOnlyPlatformAccess:true,
    releaseAuthority:false,
    error:ok?null:(result?.memory?.warning||result?.growthMultiplier?.memory?.warning||(queueErrors?'GROWTH_QUEUE_WRITE_FAILED':null)||result?.failures?.[0]?.reason||'GROWTH_SCAN_INCOMPLETE'),
  }
}
async function releaseLease(bot,token){
  // Conditional deletion: a slow previous owner may never unlock a newer owner's lease.
  const script="if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end"
  try{await durableRedis(['EVAL',script,'1',key(bot,'lease'),token])}
  catch(err){console.error('GROWTH_LEASE_RELEASE_FAILED',bot.id,errorText(err))}
}
async function runBot(bot){
  let current=null
  try{current=parse(await durableRedis(['GET',key(bot,'state')]))}
  catch(err){return {id:bot.id,status:'BLOCKED',reason:'STATE_STORAGE_UNAVAILABLE',error:errorText(err)}}
  const now=Date.now()
  let snapshot
  try{snapshot=await loadAnalyticsSnapshot(bot.platform)}
  catch(err){return {id:bot.id,status:'BLOCKED',reason:'ANALYTICS_STORAGE_UNAVAILABLE',error:errorText(err)}}
  const verified=await loadVerifiedPerformance(bot.platform)
  const newerSnapshot=snapshot.available===true && Date.parse(snapshot.capturedAt)>Date.parse(current?.analyticsCapturedAt||0)
  const newerVerified=Boolean(verified.capturedAt&&Date.parse(verified.capturedAt)>Date.parse(current?.performanceCapturedAt||0))
  // A freshly configured public API must be tested immediately, not wait for
  // the cached-research bot's old six-hour nextEligibleAt. Persist the tested
  // configuration flag even when Google's response requires cached fallback,
  // so an invalid key cannot trigger a request on every two-minute cycle.
  const youtubeApiNewlyConfigured=bot.platform==='youtube'&&
    Boolean(process.env.YOUTUBE_API_KEY)&&current?.publicApiConfigured!==true
  // One bounded live refresh when a new evidence-based growth campaign ships;
  // preserve the six-hour cadence after the new version has run once.
  const youtubeStrategyUpdated=bot.platform==='youtube'&&
    current?.strategyVersion!==YOUTUBE_STRATEGY_VERSION
  if(!newerSnapshot&&!newerVerified&&!youtubeApiNewlyConfigured&&
     !youtubeStrategyUpdated&&current?.nextEligibleAt&&Date.parse(current.nextEligibleAt)>now){
    return {id:bot.id,status:'NOT_DUE',nextEligibleAt:current.nextEligibleAt,lastStatus:current.status}
  }
  const token=bot.id+':'+process.pid+':'+now
  let acquired
  try{acquired=await durableRedis(['SET',key(bot,'lease'),token,'NX','EX',String(LEASE_SECONDS)])}
  catch(err){return {id:bot.id,status:'BLOCKED',reason:'LEASE_STORAGE_UNAVAILABLE',error:errorText(err)}}
  if(acquired!=='OK')return {id:bot.id,status:'LEASED_BY_OTHER_WORKER'}
  const start=Date.now()
  try{
    const running={
      ...current,id:bot.id,platform:bot.platform,status:'RUNNING',
      startedAt:when(start),updatedAt:when(start),zeroCreditOnly:true,
      releaseAuthority:false,independentCloudLogin:false,
    }
    await durableRedis(['SET',key(bot,'state'),JSON.stringify(running)])
    guard()
    const providerRefresh=await refreshGrowthProvider(bot.platform)
    if(providerRefresh.updated)console.log('GROWTH_PROVIDER_REFRESHED',JSON.stringify({platform:bot.platform,...providerRefresh}))
    else if(!providerRefresh.skipped)console.error('GROWTH_PROVIDER_REFRESH_UNAVAILABLE',JSON.stringify({platform:bot.platform,...providerRefresh}))
    const input=snapshot.available?{metrics:snapshot.metrics,performanceRecords:snapshot.records}:{}
    const result=await bot.run(input)
    const experimentLedger=await saveRetentionExperimentPlan(
      result?.v60RetentionExperimentPlan||{
        platform:bot.platform,status:'UNAVAILABLE',publishingLocked:true,experiments:[],
        reason:'V60_EXPERIMENT_PLAN_UNAVAILABLE',
      }
    )
    const summary=safeSummary(bot,result,snapshot)
    const finished=Date.now()
    const state={
      ...running,...summary,providerRefresh,experimentLedger,
      updatedAt:when(finished),finishedAt:when(finished),
      lastSuccessAt:summary.status==='BLOCKED'?current?.lastSuccessAt||null:when(finished),
      nextEligibleAt:when(finished+(summary.status==='BLOCKED'?RETRY_MS:period(bot))),
      elapsedMs:finished-start,
    }
    await durableRedis(['SET',key(bot,'state'),JSON.stringify(state)])
    return {id:bot.id,...summary,providerRefresh,experimentLedger,nextEligibleAt:state.nextEligibleAt,elapsedMs:state.elapsedMs}
  }catch(err){
    const finished=Date.now()
    const state={
      ...current,id:bot.id,platform:bot.platform,status:'BLOCKED',
      updatedAt:when(finished),finishedAt:when(finished),lastSuccessAt:current?.lastSuccessAt||null,
      nextEligibleAt:when(finished+RETRY_MS),error:errorText(err),
      zeroCreditOnly:true,releaseAuthority:false,
    }
    try{await durableRedis(['SET',key(bot,'state'),JSON.stringify(state)])}
    catch(writeErr){console.error('GROWTH_BOT_STATE_WRITE_FAILED',bot.id,errorText(writeErr))}
    return {id:bot.id,status:'BLOCKED',error:errorText(err),nextEligibleAt:state.nextEligibleAt}
  }finally{
    await releaseLease(bot,token)
  }
}
export async function runDueAutonomousGrowthBots(){
  const results=[]
  for(const bot of BOT_DEFINITIONS)results.push(await runBot(bot))
  return {zeroCreditOnly:true,releaseAuthority:false,results}
}
export async function getAutonomousGrowthBotStatus(){
  const bots=[]
  for(const bot of BOT_DEFINITIONS){
    try{
      const state=parse(await durableRedis(['GET',key(bot,'state')]))
      if(!state){bots.push({id:bot.id,platform:bot.platform,status:'NOT_STARTED'});continue}
      const stale=state.status==='RUNNING'
        ? Date.now()-Date.parse(state.startedAt||0)>LEASE_SECONDS*1000
        : Boolean(state.nextEligibleAt&&Date.now()-Date.parse(state.nextEligibleAt)>60*60*1000)
      bots.push({...state,status:stale?'STALE':state.status})
    }catch(err){
      bots.push({id:bot.id,platform:bot.platform,status:'BLOCKED',reason:'STATE_STORAGE_UNAVAILABLE',error:errorText(err)})
    }
  }
  return {zeroCreditOnly:process.env.ZERO_CREDIT_ONLY==='true',releaseAuthority:false,bots}
}
