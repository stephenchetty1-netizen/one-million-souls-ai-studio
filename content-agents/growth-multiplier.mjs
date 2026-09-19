import { rememberGrowthDecisions, loadGrowthMultiplierState } from './growth-multiplier-memory.mjs'

function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function ratio(n,d){return d>0?n/d:0}
function text(v){return typeof v==='string'?v.trim():''}

function zeroCreditGuard(){
  if(process.env.ZERO_CREDIT_ONLY!=='true')throw new Error('ZERO_CREDIT_ONLY_REQUIRED')
  if(process.env.GROWTH_MULTIPLIER_ALLOW_PAID_AI==='true')throw new Error('ZERO_CREDIT_POLICY_VIOLATION:GROWTH_MULTIPLIER_ALLOW_PAID_AI')
}
function platformDefaults(platform,baseline={}){
  if(platform==='youtube'){
    return {
      viewsPerPost:num(baseline.viewsPerUpload||baseline.viewsPerPost||250),
      retentionPct:num(baseline.averagePercentageViewed||40),
      conversionPct:num(baseline.subscriberConversionPercent||0.2),
      engagementPct:num(baseline.engagementRatePercent||3),
    }
  }
  return {
    viewsPerPost:num(baseline.viewsPerVideo||baseline.viewsPerPost||146),
    retentionPct:num(baseline.watchToDurationPercent||30),
    conversionPct:num(baseline.netFollowerConversionPerViewPercent||0.3),
    engagementPct:num(baseline.interactionRatePerViewPercent||8),
  }
}
function normalizedSignals(platform,record,baseline){
  const base=platformDefaults(platform,baseline)
  const views=num(record.views)
  const duration=num(record.durationSeconds)
  const avgWatch=num(record.averageWatchSeconds||record.averageViewDuration)
  const retention=num(record.averagePercentageViewed)||(duration?ratio(avgWatch,duration)*100:0)
  const likes=num(record.likes),comments=num(record.comments),shares=num(record.shares)
  const interactions=num(record.interactions)||(likes+comments+shares)
  const engagement=views?ratio(interactions,views)*100:0
  const gained=num(record.subscribersGained||record.followersAcquired||record.followersGained)
  const lost=num(record.subscribersLost||record.followersLost)
  const conversion=views?ratio(gained-lost,views)*100:0
  return {
    views,retention,engagement,conversion,
    viewIndex:ratio(views,base.viewsPerPost),
    retentionIndex:base.retentionPct?ratio(retention,base.retentionPct):0,
    engagementIndex:base.engagementPct?ratio(engagement,base.engagementPct):0,
    conversionIndex:base.conversionPct?ratio(conversion,base.conversionPct):0,
    baseline:base,
  }
}
function enoughData(record,signals){
  const ageHours=num(record.ageHours||record.hoursSincePublish)
  return signals.views>=Math.max(50,signals.baseline.viewsPerPost*0.25)||ageHours>=24
}
function classify(platform,record,baseline){
  const s=normalizedSignals(platform,record,baseline)
  if(!enoughData(record,s))return {classification:'AWAIT_DATA',score:0,signals:s,reason:'INSUFFICIENT_MEASURED_DATA'}
  const composite=
    Math.min(2,s.viewIndex)*0.35+
    Math.min(2,s.retentionIndex)*0.30+
    Math.min(2,s.engagementIndex)*0.20+
    Math.min(2,s.conversionIndex)*0.15
  const score=Math.round(clamp(composite/2*100,0,100))
  const strongRetention=s.retentionIndex>=1.10
  const strongEngagement=s.engagementIndex>=1.10
  const strongConversion=s.conversionIndex>=1.10
  const strongReach=s.viewIndex>=1.25
  if((strongReach&&(strongRetention||strongEngagement||strongConversion))||composite>=1.30){
    return {classification:'WINNER',score,signals:s,reason:'OUTPERFORMS_BASELINE_ON_MULTIPLE_SIGNALS'}
  }
  if(s.viewIndex<0.80&&(strongRetention||strongEngagement||strongConversion)){
    return {classification:'RESCUE',score,signals:s,reason:'GOOD_CONTENT_SIGNAL_WITH_WEAK_DISTRIBUTION_OR_PACKAGING'}
  }
  if(s.viewIndex<0.65&&s.retentionIndex<0.85&&s.engagementIndex<0.85){
    return {classification:'RETIRE',score,signals:s,reason:'WEAK_REACH_AND_WEAK_VIEWER_RESPONSE'}
  }
  return {classification:'MEASURE',score,signals:s,reason:'MIXED_SIGNAL_CONTINUE_MEASUREMENT'}
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
    const c=classify(platform,record,baseline)
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
