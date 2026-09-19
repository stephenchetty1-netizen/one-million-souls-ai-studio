import { durableRedis } from './durable-redis.mjs'

const PREFIX='one-million-souls:v60:retention-experiments:v1:'
const MAX_ITEMS=60
const MAX_PLAN_BYTES=24000
const PLATFORMS=new Set(['youtube','tiktok'])
const STATUS='AWAIT_TEMPLATE_REVIEW'

function parse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
function safeError(error){return String(error?.message||error).slice(0,240)}
function key(platform,id){return PREFIX+platform+':'+id}
function listKey(platform){return PREFIX+platform+':ids'}
function statusKey(platform){return PREFIX+platform+':latest-plan'}
function checkedPlatform(platform){
  const p=String(platform||'').toLowerCase()
  if(!PLATFORMS.has(p))throw new Error('UNSUPPORTED_V60_PLATFORM')
  return p
}
export function publicExperiment(item){
  if(!item||typeof item!=='object')return null
  return {
    id:item.id,platform:item.platform,createdAt:item.createdAt,
    status:item.status,sourcePostId:item.sourcePostId,
    sourceTopic:item.sourceTopic,baseline:item.baseline,
    variable:item.singleVariable,hypothesis:item.hypothesis,
    creativeBrief:item.creativeBrief,holdConstant:item.holdConstant,
    primaryMetric:item.primaryMetric,secondaryMetric:item.secondaryMetric,
    durationBand:item.durationBand,
    publishingLocked:true,publishingAuthority:false,
    humanTemplateReviewRequired:true,
    newMasterRequiresFullApproval:true,
    progress:'PROPOSED_NOT_RENDERED',
  }
}
export async function saveRetentionExperimentPlan(plan){
  if(process.env.ZERO_CREDIT_ONLY!=='true')throw new Error('ZERO_CREDIT_ONLY_REQUIRED')
  const platform=checkedPlatform(plan?.platform)
  const valid=plan?.status==='PROPOSED'&&plan?.sourceFreshness==='FRESH'&&plan?.publishingLocked===true
  const experiments=valid&&Array.isArray(plan.experiments)?plan.experiments.slice(0,3):[]
  const report={
    platform,capturedAt:plan?.capturedAt||null,
    generatedAt:plan?.createdAt||new Date().toISOString(),
    status:plan?.status||'UNAVAILABLE',
    reason:plan?.reason||null,
    eligiblePosts:Number(plan?.eligiblePosts||0),
    proposed:experiments.length,
    publishingLocked:true,publishingAuthority:false,
  }
  const body=JSON.stringify(report)
  if(body.length>MAX_PLAN_BYTES)throw new Error('V60_PLAN_TOO_LARGE')
  let staged=0,deduplicated=0
  for(const exp of experiments){
    if(exp?.mustNotAutomaticallyPost!==true||exp?.newMasterRequiresFullApproval!==true||
       exp?.decision!==STATUS||!/^V60-[a-f0-9]{16}$/.test(String(exp?.id||''))){
      throw new Error('V60_EXPERIMENT_NOT_RELEASE_LOCKED')
    }
    const item={
      ...publicExperiment({...exp,platform,createdAt:report.generatedAt}),
      status:STATUS,reviewApproved:false,
      releaseStandard:'PROFESSIONAL_MASTER',
      approvalPolicy:'UNANIMOUS_VERSION_BOUND_APPROVAL',
      requiredApprovals:50,
    }
    const added=await durableRedis(['SET',key(platform,exp.id),JSON.stringify(item),'NX'])
    if(added==='OK'){
      await durableRedis(['LPUSH',listKey(platform),exp.id])
      await durableRedis(['LTRIM',listKey(platform),'0',String(MAX_ITEMS-1)])
      staged++
    }else deduplicated++
  }
  const stored=await durableRedis(['SET',statusKey(platform),body])
  if(stored!=='OK')throw new Error('V60_PLAN_STATUS_PERSISTENCE_FAILED')
  return {platform,status:report.status,proposed:experiments.length,staged,deduplicated,persistent:true,latestCapturedAt:report.capturedAt}
}
export async function getRetentionExperimentLedger(platform,{limit=20}={}){
  const p=checkedPlatform(platform)
  const [raw,ids]=await Promise.all([
    durableRedis(['GET',statusKey(p)]),
    durableRedis(['LRANGE',listKey(p),'0',String(Math.max(0,Math.min(MAX_ITEMS,Number(limit)||20)-1))]),
  ])
  const latestPlan=parse(raw)
  const experiments=[]
  for(const id of Array.isArray(ids)?ids:[]){
    if(!/^V60-[a-f0-9]{16}$/.test(String(id)))continue
    const item=parse(await durableRedis(['GET',key(p,id)]))
    if(item?.platform===p&&item?.publishingLocked===true)experiments.push(publicExperiment(item))
  }
  return {
    platform:p,latestPlan,
    experimentCount:experiments.length,experiments,
    zeroCreditOnly:process.env.ZERO_CREDIT_ONLY==='true',
    publishingLocked:true,publishingAuthority:false,
    warning:latestPlan?.status==='PROPOSED'
      ? 'Proposed briefs require human template review and full V59 master certification; there is no direct publish action.'
      : latestPlan?.reason||'No experiment plan saved from a research cycle yet.',
  }
}
