import crypto from 'node:crypto'

const MAX_EXPERIMENTS=3
const MIN_AGE_HOURS=24
const REQUIRED_MEASUREMENTS=['views','durationSeconds','averageWatchSeconds']

function number(value){
  if(value===null||value===undefined||value==='')return null
  const n=Number(value)
  return Number.isFinite(n)&&n>=0?n:null
}
function ageHours(record,now){
  const date=record?.publishedAt||record?.publishedDate
  if(!date)return null
  const ms=Date.parse(String(date))
  if(!Number.isFinite(ms)||ms>now.getTime()+300000)return null
  return (now.getTime()-ms)/3600000
}
function durationBand(n){
  return n<=30?'SHORT':n<=45?'MEDIUM':'LONG'
}
function briefFor(platform,band,record){
  const topic=String(record.topic||record.title||'this viewer need').slice(0,120)
  if(band==='LONG'){
    return {
      variable:'RUNTIME_TRIM',
      hypothesis:'For this viewer need, a tighter original edit may retain more of the audience without omitting meaning.',
      instruction:'Make one original shorter edit by removing repetition or nonessential pauses. Keep the opening, core Scripture/context, visual style and CTA purpose consistent.',
      holdConstant:['topic','Scripture meaning','opening promise','visual identity','CTA purpose'],
      primaryMetric:'WATCH_TO_DURATION_PERCENT',
      secondaryMetric:'AVERAGE_WATCH_SECONDS',
    }
  }
  return {
    variable:'OPENING_HOOK',
    hypothesis:'A more direct opening may help viewers reach the same Scripture-based payoff.',
    instruction:'Create one fresh opening that delivers the core promise immediately. Keep length band, underlying teaching, visual identity and CTA purpose consistent.',
    holdConstant:['topic','Scripture meaning','duration band','visual identity','CTA purpose'],
    primaryMetric:platform==='youtube'?'AVERAGE_PERCENTAGE_VIEWED':'WATCH_TO_DURATION_PERCENT',
    secondaryMetric:'AVERAGE_WATCH_SECONDS',
  }
}
function experimentId(platform,postId,variable){
  return 'V60-'+crypto.createHash('sha256').update([platform,postId,variable].join('|')).digest('hex').slice(0,16)
}
export function planRetentionExperiments({platform,evidence,now=new Date(),maxExperiments=MAX_EXPERIMENTS}={}){
  if(!['youtube','tiktok'].includes(platform))throw new Error('UNSUPPORTED_EXPERIMENT_PLATFORM')
  const freshness=evidence?.freshness?.status||'UNAVAILABLE'
  const source=evidence?.source||null
  const capturedAt=evidence?.capturedAt||null
  const base={
    version:1,platform,createdAt:now.toISOString(),zeroCreditOnly:true,
    publishingLocked:true,publishingAuthority:false,
    maxConcurrentExperiments:MAX_EXPERIMENTS,
    source,capturedAt,sourceFreshness:freshness,
    measurementMethod:'Compare separate original posts within similar topic and duration cohorts. Observational changes do not establish causation.',
    qualityGates:[
      'Human approval of the first reusable edit template',
      'Verified Scripture and factual context',
      'Copyright/voice/music rights verified',
      'Full video decode, real motion, captions, safe zones and audio quality',
      'New master hash and all standard V59 approvals before any release',
    ],
  }
  if(freshness!=='FRESH'){
    return {...base,status:'BLOCKED_STALE_OR_MISSING_MEASUREMENTS',eligiblePosts:0,experiments:[],
      reason:'Fresh measured post-level watch-time evidence is required; a stored or empty report cannot establish a current experiment baseline.'}
  }
  const eligible=(Array.isArray(evidence?.records)?evidence.records:[])
    .map(record=>{
      const views=number(record.views)
      const duration=number(record.durationSeconds)
      const watch=number(record.averageWatchSeconds)
      const age=ageHours(record,now)
      if(views===null||views<50||duration===null||duration<=0||watch===null||age===null||age<MIN_AGE_HOURS)return null
      const postId=String(record.postId||record.videoId||record.id||'')
      if(!postId)return null
      const ratio=watch/duration*100
      if(!Number.isFinite(ratio))return null
      return {record,views,duration,watch,age,ratio,postId,band:durationBand(duration)}
    })
    .filter(Boolean)
    .sort((a,b)=>a.ratio-b.ratio)
  if(eligible.length<2){
    return {...base,status:'BLOCKED_INSUFFICIENT_COMPARABLE_POSTS',eligiblePosts:eligible.length,
      experiments:[],reason:'At least two mature posts with measured views, duration and watch time are required.'}
  }
  const byBand=new Map()
  for(const item of eligible){
    if(!byBand.has(item.band))byBand.set(item.band,item)
  }
  const selected=[...byBand.values()].sort((a,b)=>a.ratio-b.ratio).slice(0,Math.min(MAX_EXPERIMENTS,Math.max(0,Number(maxExperiments)||0)))
  const experiments=selected.map(item=>{
    const plan=briefFor(platform,item.band,item.record)
    return {
      id:experimentId(platform,item.postId,plan.variable),
      status:'PROPOSED_NOT_RENDERED',
      sourcePostId:item.postId,
      sourceTopic:String(item.record.topic||item.record.title||'').slice(0,160),
      publishedDate:item.record.publishedDate||item.record.publishedAt||null,
      durationBand:item.band,
      singleVariable:plan.variable,
      hypothesis:plan.hypothesis,
      creativeBrief:plan.instruction,
      holdConstant:plan.holdConstant,
      primaryMetric:plan.primaryMetric,
      secondaryMetric:plan.secondaryMetric,
      baseline:{
        views:item.views,durationSeconds:item.duration,averageWatchSeconds:item.watch,
        watchToDurationPercent:Number(item.ratio.toFixed(2)),
        ageHours:Number(item.age.toFixed(1)),
        capturedAt,
      },
      originalVariantRequired:true,
      newMasterRequiresFullApproval:true,
      mustNotAutomaticallyPost:true,
      decision:'AWAIT_TEMPLATE_REVIEW',
    }
  })
  return {...base,status:experiments.length?'PROPOSED':'BLOCKED_NO_ELIGIBLE_DURATION_BANDS',
    eligiblePosts:eligible.length,experiments}
}
