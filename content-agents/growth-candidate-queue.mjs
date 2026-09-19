import crypto from 'node:crypto'
import { durableRedis } from './durable-redis.mjs'

const LIST_KEY='one-million-souls:growth-multiplier:candidate-queue:v1'
const PREFIX='one-million-souls:growth-multiplier:candidate:v1:'
const TTL_SECONDS=60*60*24*30
const MAX_QUEUE=100

function stableId(candidate){
  const raw=[
    candidate.platform||'',
    candidate.sourcePostId||'',
    candidate.type||'',
    candidate.topic||'',
    candidate.brief||''
  ].join('|')
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0,24)
}
function normalize(candidate){
  const id=candidate.id||stableId(candidate)
  return {
    id,
    createdAt:candidate.createdAt||new Date().toISOString(),
    source:'GROWTH_MULTIPLIER',
    platform:String(candidate.platform||''),
    type:String(candidate.type||'GROWTH_CANDIDATE'),
    topic:String(candidate.topic||''),
    sourcePostId:String(candidate.sourcePostId||''),
    brief:String(candidate.brief||''),
    reason:String(candidate.reason||''),
    classification:String(candidate.classification||''),
    priority:Number(candidate.priority||50),
    publishingLocked:true,
    productionStatus:'PRE_PRODUCTION_CANDIDATE',
    requiresNormalV59Approval:true,
    requiredApprovals:50,
    releaseStandard:'PROFESSIONAL_MASTER',
    approvalPolicy:'UNANIMOUS_VERSION_BOUND_APPROVAL',
  }
}
export async function stageGrowthCandidate(candidate){
  const item=normalize(candidate)
  const key=PREFIX+item.id
  const created=await durableRedis(['SET',key,JSON.stringify(item),'EX',String(TTL_SECONDS),'NX'])
  if(created!=='OK')return {staged:false,deduplicated:true,item}
  await durableRedis(['LPUSH',LIST_KEY,item.id])
  await durableRedis(['LTRIM',LIST_KEY,'0',String(MAX_QUEUE-1)])
  return {staged:true,deduplicated:false,item}
}
export async function stageGrowthCandidates(candidates=[]){
  const results=[]
  for(const candidate of (Array.isArray(candidates)?candidates:[]).slice(0,20)){
    try{results.push(await stageGrowthCandidate(candidate))}
    catch(error){results.push({staged:false,error:error instanceof Error?error.message:String(error),candidate})}
  }
  return {
    staged:results.filter(x=>x.staged).length,
    deduplicated:results.filter(x=>x.deduplicated).length,
    failed:results.filter(x=>x.error).length,
    results,
  }
}
export async function getGrowthCandidate(id){
  const raw=await durableRedis(['GET',PREFIX+String(id||'')])
  if(!raw)return null
  try{return JSON.parse(raw)}catch{return null}
}
export async function listGrowthCandidates(limit=20){
  const ids=await durableRedis(['LRANGE',LIST_KEY,'0',String(Math.max(0,Math.min(99,Number(limit)||20)-1))])
  const out=[]
  for(const id of Array.isArray(ids)?ids:[]){
    const item=await getGrowthCandidate(id)
    if(item)out.push(item)
  }
  return out.sort((a,b)=>Number(b.priority||0)-Number(a.priority||0))
}
