import fs from 'node:fs/promises'
import path from 'node:path'
import { loadTikTokGrowthState, rememberTikTokGrowthScan } from './tiktok-growth-memory.mjs'
import { recommendChannelAttractions } from './channel-attraction-selector.mjs'
import { runGrowthMultiplier } from './growth-multiplier.mjs'

export const TIKTOK_GROWTH_BOTS=Object.freeze([
  {id:'tt-hook-lab-bot',job:'Improve the first 1-2 seconds using the channel’s measured retention evidence.'},
  {id:'tt-retention-bot',job:'Compare average watch time with duration and recommend pacing/cutdown changes.'},
  {id:'tt-search-intent-bot',job:'Find Christian topic/search-intent patterns from public evidence without paid AI.'},
  {id:'tt-topic-opportunity-bot',job:'Score topic opportunities using owned-channel performance plus public evidence.'},
  {id:'tt-caption-packaging-bot',job:'Keep captions readable, relevant and non-spammy while preserving Scripture context.'},
  {id:'tt-shareability-bot',job:'Identify truthful, useful content structures likely to earn legitimate shares.'},
  {id:'tt-follower-conversion-bot',job:'Improve legitimate follower conversion through series continuity and delivered value.'},
  {id:'tt-posting-window-bot',job:'Use measured audience-availability windows rather than generic posting-time claims.'},
  {id:'tt-fatigue-guard-bot',job:'Block near-duplicate topics, captions, hashtags and repetitive emotional promises.'},
  {id:'tt-experiment-manager-bot',job:'Run controlled one-variable-at-a-time experiments and retain measured winners.'},
])

const DEFAULT_TOPICS=Object.freeze([
  'prayer',
  'Bible verse',
  'Christian motivation',
  'Jesus',
  'faith over fear',
  'God is with you',
  'Bible questions',
  'Christian youth',
])

const BLOCKED_GROWTH_TACTICS=Object.freeze([
  'follow for follow','follow4follow','f4f','like for like','view for view','buy followers',
  'buy views','engagement pod','traffic bot','watch-time bot','watch time bot','fake followers',
])

function clean(value){return typeof value==='string'?value.trim():''}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function ratio(n,d){return d>0?n/d:0}
function words(value){
  return new Set(String(value||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x=>x.length>2))
}
function similarity(a,b){
  const aa=words(a),bb=words(b)
  if(!aa.size||!bb.size)return 0
  let common=0
  for(const x of aa)if(bb.has(x))common++
  return common/(aa.size+bb.size-common)
}
function zeroCreditGuard(){
  if(process.env.ZERO_CREDIT_ONLY!=='true')throw new Error('ZERO_CREDIT_ONLY_REQUIRED')
  if(process.env.TIKTOK_GROWTH_ALLOW_PAID_AI==='true')throw new Error('ZERO_CREDIT_POLICY_VIOLATION:TIKTOK_GROWTH_ALLOW_PAID_AI')
}
export function growthIntegrityGuard(input={}){
  const text=JSON.stringify(input).toLowerCase()
  const blocked=BLOCKED_GROWTH_TACTICS.filter(x=>text.includes(x))
  if(blocked.length)throw new Error('ARTIFICIAL_ENGAGEMENT_BLOCKED:'+blocked.join(','))
  return {status:'PASS',artificialEngagement:false}
}
async function readJson(name,fallback={}){
  try{return JSON.parse(await fs.readFile(path.join(process.cwd(),'content-agents',name),'utf8'))}
  catch{return fallback}
}
function engagementRate(post){
  return ratio(Number(post.likes||0)+Number(post.comments||0)+Number(post.shares||0),Number(post.views||0))*100
}
function retentionRatio(post){
  return ratio(Number(post.averageWatchSeconds||0),Number(post.durationSeconds||0))*100
}
function ownTopicMatch(topic,posts){
  let best=null
  for(const post of posts){
    const sim=similarity(topic,post.topic||'')
    if(!best||sim>best.similarity)best={...post,similarity:sim}
  }
  return best
}
function recentTopicPenalty(topic,state,posts){
  let penalty=0
  for(const item of (state?.recentTopics||[]).slice(0,24)){
    const sim=similarity(topic,item?.topic||item?.key||'')
    if(sim>=0.8)penalty=Math.max(penalty,20)
    else if(sim>=0.5)penalty=Math.max(penalty,10)
  }
  for(const post of posts.slice(0,12)){
    const sim=similarity(topic,post.topic||'')
    if(sim>=0.85)penalty=Math.max(penalty,18)
    else if(sim>=0.55)penalty=Math.max(penalty,8)
  }
  return penalty
}
function cachedPublicEvidence(topic,patterns,trends){
  const query=words(topic)
  const examples=(patterns?.examples||[]).filter((x)=>{
    if(!/tiktok/i.test(String(x.platform||'')))return false
    const hay=words([x.title,x.format,...(x.pattern||[])].join(' '))
    for(const q of query)if(hay.has(q))return true
    return false
  }).map((x)=>({
    creator:x.creator||'',
    title:x.title||'',
    views:Number(x.views||0),
    likes:Number(x.likes||0),
    format:x.format||'',
    patterns:x.pattern||[],
    source:x.source||null,
  })).sort((a,b)=>b.views-a.views).slice(0,8)
  const trendSignals=(trends?.externalTrendSignals||[]).filter((s)=>{
    const hay=words(s?.signal||'')
    for(const q of query)if(hay.has(q))return true
    return false
  })
  return {examples,trendSignals}
}
function opportunityScore(topic,evidence,ownMatch,state,posts){
  const publicViews=evidence.examples.reduce((a,x)=>a+Number(x.views||0),0)
  const publicDemand=Math.min(30,Math.log10(publicViews+1)*4.5)
  const publicDiversity=Math.min(15,new Set(evidence.examples.map(x=>x.creator).filter(Boolean)).size*4)
  const owned=ownMatch&&ownMatch.similarity>=0.35
    ? Math.min(30,
        Math.min(15,retentionRatio(ownMatch)*0.35)+
        Math.min(10,engagementRate(ownMatch)*0.45)+
        Math.min(5,Math.log10(Number(ownMatch.views||0)+1)*2)
      )
    : 8
  const need=12
  const fatigue=recentTopicPenalty(topic,state,posts)
  return Math.round(clamp(publicDemand+publicDiversity+owned+need-fatigue,0,100))
}
function formatSuggestions(topic,ownMatch,evidence){
  const suggestions=[]
  if(ownMatch&&retentionRatio(ownMatch)>=30)suggestions.push('Preserve the opening pace and clarity from the closest strong owned-channel example.')
  if(evidence.examples.some(x=>/prayer/i.test(String(x.format))))suggestions.push('Test a direct-to-viewer prayer version that begins the prayer immediately.')
  suggestions.push('Test a search-intent version that names one specific problem or Bible question in the first line.')
  suggestions.push('Keep the visual sequence moving; avoid turning the video into a static poster or long block of text.')
  return suggestions.slice(0,4)
}
export function inspectTikTokCaption(caption,recentCaptions=[]){
  const value=clean(caption)
  const tags=value.match(/#[\p{L}\p{N}_]+/gu)||[]
  const lowerTags=tags.map(x=>x.toLowerCase())
  const genericFyp=lowerTags.filter(x=>/^#(?:fyp|foryou|foryoupage|fypp+)/.test(x))
  const duplicate=recentCaptions.reduce((m,x)=>Math.max(m,similarity(value,x)),0)
  const warnings=[]
  if(tags.length>5)warnings.push('more than five hashtags')
  if(genericFyp.length>1)warnings.push('repetitive generic FYP hashtags')
  if(value.length>1200)warnings.push('caption is excessively long for fast-scrolling packaging')
  if(duplicate>=0.72)warnings.push('near-duplicate of a recent caption')
  if(/guaranteed miracle|miracle in 24 hours|god told me you|type amen to receive|share this or|you will be rich/i.test(value))warnings.push('unsupported or manipulative promise')
  if(/#fypp{4,}/i.test(value))warnings.push('hashtag spam pattern')
  return {
    status:warnings.length?'REVISE':'PASS',
    warnings,
    hashtagCount:tags.length,
    genericFypHashtagCount:genericFyp.length,
    recentCaptionSimilarity:Number(duplicate.toFixed(2)),
  }
}
export function retentionActions(metrics={}){
  const duration=Number(metrics.durationSeconds||0)
  const avg=Number(metrics.averageWatchSeconds||0)
  const watchRatio=duration>0?avg/duration*100:Number(metrics.watchToDurationPercent||0)
  const actions=[]
  if(watchRatio>0&&watchRatio<20)actions.push('Shorten the video or move the payoff much earlier; current watch-to-duration ratio is weak.')
  else if(watchRatio>=20&&watchRatio<35)actions.push('Keep the core topic but strengthen the first 1-2 seconds and remove mid-video repetition.')
  else if(watchRatio>=35)actions.push('Preserve this hook/pacing structure as a control while testing only one new variable.')
  if(avg>0&&avg<6)actions.push('Front-load the strongest Scripture truth or viewer benefit before second 3.')
  if(!actions.length)actions.push('Use measured post-level watch time before changing duration or hook strategy.')
  return actions
}
export function followerActions(metrics={}){
  const views=Number(metrics.views||0)
  const acquired=Number(metrics.followersAcquired||0)
  const lost=Number(metrics.followersLost||0)
  const net=acquired-lost
  return {
    netFollowers:net,
    netFollowerConversionPercent:views?Number((net/views*100).toFixed(3)):null,
    actions:[
      'Build recurring named series so viewers know what following will give them next.',
      'Place the follow CTA after real value is delivered, not as the opening.',
      'Use replies and follow-up videos for genuine audience questions rather than generic comment bait.',
      'Link related posts through a clear series theme and consistent promise.',
    ],
  }
}
function benchmark(metrics,base){
  const views=Number(metrics.views||base?.metrics?.views||0)
  const videos=Number(metrics.videos||base?.metrics?.videos||0)
  const interactions=Number(metrics.interactions||base?.metrics?.interactions||0)
  const acquired=Number(metrics.followersAcquired||base?.metrics?.followersAcquired||0)
  const lost=Number(metrics.followersLost||base?.metrics?.followersLost||0)
  return {
    views,
    videos,
    viewsPerVideo:videos?Number((views/videos).toFixed(2)):null,
    interactions,
    interactionRatePerViewPercent:views?Number((interactions/views*100).toFixed(2)):null,
    followersAcquired:acquired,
    followersLost:lost,
    netFollowers:acquired-lost,
    netFollowerConversionPerViewPercent:views?Number(((acquired-lost)/views*100).toFixed(3)):null,
    strongestRecurringHoursSast:base?.audienceTiming?.strongestRecurringHours||[],
    strongMidweekWindows:base?.audienceTiming?.strongMidweekWindows||[],
  }
}
export async function runTikTokGrowthScan(input={}){
  zeroCreditGuard()
  growthIntegrityGuard(input)
  const [state,base,recent,patterns,trends]=await Promise.all([
    loadTikTokGrowthState(),
    readJson('tiktok-growth-baseline.json',{metrics:{},audienceTiming:{}}),
    readJson('tiktok-recent-performance.json',{posts:[]}),
    readJson('million-view-patterns.json',{examples:[]}),
    readJson('trend-evidence.json',{externalTrendSignals:[]}),
  ])
  const posts=Array.isArray(input.performanceRecords)&&input.performanceRecords.length
    ? input.performanceRecords
    : (Array.isArray(recent.posts)?recent.posts:[])
  const recentCaptions=Array.isArray(input.recentCaptions)?input.recentCaptions.filter(Boolean).slice(0,50):posts.map(x=>x.topic)
  const topics=(Array.isArray(input.topics)&&input.topics.length?input.topics:DEFAULT_TOPICS).map(clean).filter(Boolean).slice(0,8)
  const metrics={...(base.metrics||{}),...(input.metrics||{})}
  const opportunities=topics.map((topic)=>{
    const evidence=cachedPublicEvidence(topic,patterns,trends)
    const ownMatch=ownTopicMatch(topic,posts)
    const score=opportunityScore(topic,evidence,ownMatch,state,posts)
    return {
      topic,
      opportunityScore:score,
      decision:score>=65?'DEVELOP':score>=50?'RESEARCH_MORE':'HOLD',
      evidenceMode:'ZERO_CREDIT_CACHED_PUBLIC_EVIDENCE_PLUS_OWNED_ANALYTICS',
      publicExamples:evidence.examples,
      trendSignals:evidence.trendSignals,
      closestOwnedExample:ownMatch?{
        topic:ownMatch.topic,
        similarity:Number(ownMatch.similarity.toFixed(2)),
        views:ownMatch.views,
        durationSeconds:ownMatch.durationSeconds,
        averageWatchSeconds:ownMatch.averageWatchSeconds,
        watchToDurationPercent:Number(retentionRatio(ownMatch).toFixed(1)),
        engagementRatePercent:Number(engagementRate(ownMatch).toFixed(1)),
      }:null,
      formatSuggestions:formatSuggestions(topic,ownMatch,evidence),
    }
  }).sort((a,b)=>b.opportunityScore-a.opportunityScore)
  const attractions=await recommendChannelAttractions({platform:'tiktok',opportunities,recentTopics:state.recentTopics||[],metrics:benchmark(metrics,base)})
  const multiplierRecords=posts
  const multiplier=await runGrowthMultiplier({platform:'tiktok',records:multiplierRecords,baseline:benchmark(metrics,base),opportunities,attractions})
  const result={
    ok:true,
    zeroCreditOnly:true,
    artificialEngagement:false,
    writeActionsToTikTok:false,
    scannedAt:new Date().toISOString(),
    bots:TIKTOK_GROWTH_BOTS,
    researchMode:'OWNED_METRICS_PLUS_CACHED_PUBLIC_EVIDENCE',
    promotionPolicy:{developAtScore:65,researchMoreAtScore:50,oneVariableExperiment:true},
    benchmark:benchmark(metrics,base),
    postingWindows:{
      timezone:'Africa/Johannesburg',
      strongestRecurringHours:base?.audienceTiming?.strongestRecurringHours||[],
      strongMidweekWindows:base?.audienceTiming?.strongMidweekWindows||[],
      source:'Metricool connected audience-availability data captured 2026-09-19',
    },
    recentPerformance:posts.slice(0,12),
    opportunities,
    channelAttractions:attractions,
    growthMultiplier:multiplier,
    retention:retentionActions(input.metrics?.durationSeconds?input.metrics:(posts[0]||base?.recentPostSignal||{})),
    followerGrowth:followerActions(metrics),
    captionInspection:input.caption?inspectTikTokCaption(input.caption,recentCaptions):null,
  }
  const remembered=await rememberTikTokGrowthScan(result,metrics)
  result.memory={
    persistent:!remembered.persistenceWarning,
    recentTopicCount:(remembered.recentTopics||[]).length,
    metricSnapshots:(remembered.metricsHistory||[]).length,
    experimentCount:(remembered.experiments||[]).length,
    warning:remembered.persistenceWarning||null,
  }
  return result
}
