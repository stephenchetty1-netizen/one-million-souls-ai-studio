import { rememberGrowthDecisions, loadGrowthMultiplierState } from './growth-multiplier-memory.mjs'
import { stageGrowthCandidates } from './growth-candidate-queue.mjs'

function metric(value){
  if(value===undefined||value===null||value==='')return null
  const n=Number(value)
  return Number.isFinite(n)&&n>=0?n:null
}
function firstMetric(...values){
  for(const value of values){
    const n=metric(value)
    if(n!==null)return n
  }
  return null
}
function positive(...values){
  for(const value of values){
    const n=metric(value)
    if(n!==null&&n>0)return n
  }
  return null
}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function ratio(n,d){return Number.isFinite(n)&&Number.isFinite(d)&&d>0?n/d:null}
function text(v){return typeof v==='string'?v.trim():''}

function zeroCreditGuard(){
  if(process.env.ZERO_CREDIT_ONLY!=='true')throw new Error('ZERO_CREDIT_ONLY_REQUIRED')
  if(process.env.GROWTH_MULTIPLIER_ALLOW_PAID_AI==='true')throw new Error('ZERO_CREDIT_POLICY_VIOLATION:GROWTH_MULTIPLIER_ALLOW_PAID_AI')
}
function platformDefaults(platform,baseline={}){
  const viewsPerPost=positive(baseline.viewsPerUpload,baseline.viewsPerVideo,baseline.viewsPerPost)
  const retentionPct=positive(baseline.averagePercentageViewed,baseline.watchToDurationPercent)
  const conversionPct=positive(baseline.subscriberConversionPercent,baseline.netFollowerConversionPerViewPercent)
  const engagementPct=positive(baseline.engagementRatePercent,baseline.interactionRatePerViewPercent)
  return {viewsPerPost,retentionPct,conversionPct,engagementPct}
}
function publicationAgeHours(record){
  const explicit=metric(record.ageHours??record.hoursSincePublish)
  if(explicit!==null)return explicit
  const date=record.publishedAt||record.publishedDate
  if(!date)return null
  const ms=Date.parse(String(date))
  if(!Number.isFinite(ms)||ms>Date.now()+5*60*1000)return null
  return Math.max(0,(Date.now()-ms)/3600000)
}
function normalizedSignals(platform,record,baseline){
  const base=platformDefaults(platform,baseline)
  const views=metric(record.views)
  const duration=positive(record.durationSeconds)
  const avgWatch=metric(record.averageWatchSeconds??record.averageViewDuration)
  const explicitRetention=metric(record.averagePercentageViewed??record.watchToDurationPercent)
  const retention=explicitRetention!==null?explicitRetention
    :(duration!==null&&avgWatch!==null?avgWatch/duration*100:null)
  const interactions=metric(record.interactions)
  const likes=metric(record.likes),comments=metric(record.comments),shares=metric(record.shares)
  const engagementCount=interactions!==null?interactions
    :(likes!==null&&comments!==null&&shares!==null?likes+comments+shares:null)
  const engagement=views!==null&&views>0&&engagementCount!==null?engagementCount/views*100:null
  const gained=firstMetric(record.subscribersGained,record.followersAcquired,record.followersGained)
  const lost=firstMetric(record.subscribersLost,record.followersLost)
  const conversion=views!==null&&views>0&&gained!==null&&lost!==null?(gained-lost)/views*100:null
  const viewIndex=ratio(views,base.viewsPerPost)
  const retentionIndex=ratio(retention,base.retentionPct)
  const engagementIndex=ratio(engagement,base.engagementPct)
  const conversionIndex=ratio(conversion,base.conversionPct)
  const ageHours=publicationAgeHours(record)
  const comparableSignals=[viewIndex,retentionIndex,engagementIndex,conversionIndex].filter(Number.isFinite).length
  return {
    views,retention,engagement,conversion,viewIndex,retentionIndex,
    engagementIndex,conversionIndex,ageHours,comparableSignals,
    baseline:base,
    missingSignals:[
      ...(viewIndex===null?['COMPARABLE_VIEWS']:[]),
      ...(retentionIndex===null?['COMPARABLE_RETENTION']:[]),
      ...(engagementIndex===null?['COMPARABLE_ENGAGEMENT']:[]),
      ...(conversionIndex===null?['COMPARABLE_CONVERSION']:[]),
      ...(ageHours===null?['PUBLICATION_AGE']:[]),
    ],
  }
}
export function classifyGrowthPost(platform,record,baseline){
  if(!['youtube','tiktok'].includes(platform))throw new Error('UNSUPPORTED_GROWTH_PLATFORM')
  const s=normalizedSignals(platform,record||{},baseline||{})
  if(s.views===null||s.viewIndex===null||s.ageHours===null){
    return {classification:'AWAIT_DATA',score:null,signals:s,reason:'MISSING_MEASURED_REACH_BASELINE_OR_POST_AGE'}
  }
  const evidence=[
    [s.viewIndex,0.35],
    [s.retentionIndex,0.30],
    [s.engagementIndex,0.20],
    [s.conversionIndex,0.15],
  ].filter(([index])=>Number.isFinite(index))
  const totalWeight=evidence.reduce((sum,[,weight])=>sum+weight,0)
  const composite=totalWeight>0?evidence.reduce((sum,[index,weight])=>sum+clamp(index,0,2)*weight,0)/totalWeight:null
  const score=composite===null?null:Math.round(clamp(composite/2*100,0,100))
  if(s.ageHours<24 || s.views<Math.max(50,(s.baseline.viewsPerPost||0)*0.25)){
    return {classification:'AWAIT_DATA',score,signals:s,reason:'POST_TOO_NEW_OR_TOO_LITTLE_MEASURED_REACH'}
  }
  if(s.comparableSignals<2){
    return {classification:'MEASURE',score,signals:s,reason:'ADDITIONAL_MEASURED_VIEWER_SIGNALS_REQUIRED'}
  }
  const strongAudience=[s.retentionIndex,s.engagementIndex,s.conversionIndex]
    .some(x=>x!==null&&x>=1.10)
  if(s.viewIndex>=1.25&&strongAudience){
    return {classification:'WINNER',score,signals:s,reason:'MEASURED_REACH_AND_VIEWER_RESPONSE_OUTPERFORM_BASELINE'}
  }
  if(s.viewIndex<0.80&&strongAudience){
    return {classification:'RESCUE',score,signals:s,reason:'MEASURED_VIEWER_RESPONSE_STRONG_BUT_REACH_WEAK'}
  }
  if(s.ageHours>=48&&s.viewIndex<0.65
      &&s.retentionIndex!==null&&s.retentionIndex<0.85
      &&s.engagementIndex!==null&&s.engagementIndex<0.85){
    return {classification:'RETIRE',score,signals:s,reason:'MATURE_POST_WITH_MULTIPLE_MEASURED_WEAK_SIGNALS'}
  }
  return {classification:'MEASURE',score,signals:s,reason:'CONTINUE_MEASURING_WITH_AVAILABLE_EVIDENCE'}
}

function viewerNeed(record){
  return text(record.viewerNeed||record.topic||record.title||record.caption||'the same viewer need')
}
function variants(platform,record){
  const need=viewerNeed(record)
  const shared=[
    {type:'DIRECT_PRAYER',brief:'Create a fresh direct-to-viewer prayer serving "'+need+'". Start useful content immediately; do not reuse the original wording.'},
    {type:'BIBLE_ANSWER',brief:'Create an original Scripture-grounded answer to the question or need behind "'+need+'", with verified context.'},
    {type:'STORY_ANGLE',brief:'Create a story-led version of "'+need+'" using an authentic biblical narrative or clearly sourced real testimony; never fabricate testimony.'},
    {type:'FAST_RESET',brief:'Create a concise 20-30 second reset around "'+need+'" with one truth, one Scripture reference and one practical response.'},
    {type:'DEEPER_COMPANION',brief:'Create a deeper companion treatment of "'+need+'" that adds genuinely new value rather than stretching the same script.'},
  ]
  return shared.map((v,i)=>({
    id:platform+'-'+Date.now()+'-'+(i+1),
    ...v,
    platform,
    originalityRequired:true,
    exactScriptReuse:false,
    packagingRebuildRequired:true,
  }))
}
function rescuePlan(platform,record){
  const need=viewerNeed(record)
  if(platform==='youtube'){
    return [
      'Retest the title around the specific viewer need "'+need+'" without changing the factual promise.',
      'Create a new thumbnail direction with one focal point and minimal text.',
      'If retention is strong, preserve the master content; do not rerender solely to chase clicks.',
      'Route the video into the closest relevant playlist/series and companion Short.',
    ]
  }
  return [
    'Repackage the opening/caption around the specific need "'+need+'" without reposting an identical asset.',
    'Create a shorter original cut only if watch-to-duration evidence indicates the payoff comes too late.',
    'Remove generic FYP hashtag spam and use only relevant searchable terms.',
    'Use the idea in a fresh follow-up rather than repeatedly reposting the same file.',
  ]
}
function clusterPlan(record){
  const need=viewerNeed(record)
  return {
    clusterName:need+' Content Cluster',
    pieces:[
      'Search-intent answer: "'+need+'"',
      'Direct prayer serving "'+need+'"',
      'One Question. One Verse. episode for "'+need+'"',
      '30-Second Reset for "'+need+'"',
      'Longer/deeper companion for "'+need+'"',
    ],
    maximumInitialPieces:5,
    rule:'Release only pieces that independently pass topic evidence, theology, originality, production and publishing gates.',
  }
}
function collaborationPrompt(record){
  const need=viewerNeed(record)
  return {
    topic:need,
    brief:'Look for compatible Christian creators whose audience already engages with "'+need+'". Prefer complementary expertise and genuine shared value over follower-count chasing.',
    rules:['No unsolicited spam automation.','No fake endorsements.','No paid follower-exchange arrangements.','Human approval required before outreach.'],
  }
}
export async function runGrowthMultiplier({platform,records=[],baseline={},opportunities=[],attractions={}}={}){
  zeroCreditGuard()
  if(!['youtube','tiktok'].includes(platform))throw new Error('UNSUPPORTED_GROWTH_PLATFORM')
  const prior=await loadGrowthMultiplierState()
  const decisions=(Array.isArray(records)?records:[]).slice(0,50).map((record)=>{
    const c=classifyGrowthPost(platform,record,baseline)
    const core={
      platform,
      postId:text(record.postId||record.videoId||record.id||record.url),
      title:text(record.title||record.caption||record.topic),
      topic:text(record.topic||record.viewerNeed||record.title||record.caption),
      classification:c.classification,
      score:c.score,
      reason:c.reason,
      signals:c.signals,
    }
    if(c.classification==='WINNER'){
      return {...core,nextAction:'MULTIPLY_WITH_ORIGINAL_VARIATIONS',variations:variants(platform,record),cluster:clusterPlan(record),collaboration:collaborationPrompt(record)}
    }
    if(c.classification==='RESCUE'){
      return {...core,nextAction:'REPACKAGE_OR_FOLLOW_UP_WITHOUT_DUPLICATE_REPOST',rescuePlan:rescuePlan(platform,record)}
    }
    if(c.classification==='RETIRE'){
      return {...core,nextAction:'RETIRE_PATTERN_AND_RECORD_LESSON',retireRule:'Do not automatically regenerate this pattern until new evidence changes the case.'}
    }
    return {...core,nextAction:c.classification==='AWAIT_DATA'?'WAIT_FOR_MEASURED_DATA':'CONTINUE_MEASURING_ONE_VARIABLE_AT_A_TIME'}
  })
  const remembered=await rememberGrowthDecisions(decisions)
  const winners=decisions.filter(x=>x.classification==='WINNER')
  const rescues=decisions.filter(x=>x.classification==='RESCUE')
  const retired=decisions.filter(x=>x.classification==='RETIRE')
  const opportunitySeeds=(opportunities||[]).filter(x=>Number(x.opportunityScore||0)>=65).slice(0,5)
  const attractionSeeds=(attractions?.featured||[]).slice(0,4)
  const queueCandidates=[]
  for(const winner of winners.slice(0,3)){
    for(const variation of (winner.variations||[]).slice(0,5)){
      queueCandidates.push({
        platform,
        type:'WINNER_VARIATION_'+variation.type,
        topic:winner.topic||winner.title,
        sourcePostId:winner.postId,
        brief:variation.brief,
        reason:winner.reason,
        classification:'WINNER',
        priority:90,
      })
    }
  }
  for(const rescue of rescues.slice(0,3)){
    queueCandidates.push({
      platform,
      type:'RESCUE_REPACKAGE',
      topic:rescue.topic||rescue.title,
      sourcePostId:rescue.postId,
      brief:(rescue.rescuePlan||[]).join(' '),
      reason:rescue.reason,
      classification:'RESCUE',
      priority:80,
    })
  }
  for(const gap of opportunitySeeds.slice(0,2)){
    queueCandidates.push({
      platform,
      type:'SEARCH_GAP',
      topic:gap.topic,
      brief:'Create an original search-led content brief for "'+String(gap.topic||'')+'" using verified Scripture/factual context and platform-specific packaging.',
      reason:'HIGH_OPPORTUNITY_SEARCH_GAP',
      classification:'OPPORTUNITY',
      priority:70,
    })
  }
  const queue=await stageGrowthCandidates(queueCandidates)
  return {
    ok:true,
    platform,
    zeroCreditOnly:true,
    artificialEngagement:false,
    publishingAuthority:false,
    generatedAt:new Date().toISOString(),
    policy:{
      winnerExpansionMaxVariants:5,
      rescueBeforeDiscard:true,
      noDuplicateRepost:true,
      platformSpecificPackaging:true,
      humanOutreachApprovalRequired:true,
      productionAndReleaseGatesRemainMandatory:true,
    },
    decisions,
    winners,
    rescues,
    retired,
    searchGapSeeds:opportunitySeeds.map(x=>({topic:x.topic,score:x.opportunityScore,action:'Build original search-led content around the unmet viewer need; do not copy competitor expression.'})),
    attractionSeeds:attractionSeeds.map(x=>({id:x.id,name:x.name,score:x.attractionScore,action:'Use as a recurring return reason only while measured performance remains healthy.'})),
    preProductionQueue:queue,
    priorState:{
      winnersStored:(prior.winners||[]).length,
      rescuesStored:(prior.rescues||[]).length,
      retiredStored:(prior.retired||[]).length,
    },
    memory:{
      persistent:!remembered.persistenceWarning,
      winnersStored:(remembered.winners||[]).length,
      rescuesStored:(remembered.rescues||[]).length,
      retiredStored:(remembered.retired||[]).length,
      warning:remembered.persistenceWarning||null,
    },
  }
}
