import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { POST as corePOST } from '@/app/api/distribution/publish-core/route'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

const redisUrl=(process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL||'').replace(/\/$/,'')
const redisToken=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN||''
const REQUIRED_GATES=[
  'rightsStatus','theologyStatus','factualStatus','mediaIntegrity','captionSync',
  'audioMix','visualQuality','thumbnailQuality','contentQuality','lyricSync',
  'originality','professionalExecution','technicalMaster','creativeMaster'
]

async function requiredAgents(){
  const raw=await fs.readFile(path.join(process.cwd(),'content-agents','approval-policy.json'),'utf8')
  const policy=JSON.parse(raw)
  const agents=Array.isArray(policy.requiredAgents)?policy.requiredAgents.map(String):[]
  if(agents.length!==Number(policy.requiredApprovals||agents.length)||agents.length<1)throw new Error('Invalid approval policy configuration')
  if(agents[agents.length-1]!=='publisher')throw new Error('Approval policy requires publisher to be last')
  return agents
}
function canonicalize(value:any):any{
  if(Array.isArray(value))return value.map(canonicalize)
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonicalize(value[key])]))
  return value
}
function sameCanonical(a:any,b:any){return JSON.stringify(canonicalize(a))===JSON.stringify(canonicalize(b))}
function validateCanonicalRequest(body:any,releasePayload:any,problems:string[]){
  const checks=[
    ['title',releasePayload?.title],
    ['script',releasePayload?.script],
    ['caption',releasePayload?.caption],
    ['platforms',releasePayload?.platforms],
    ['platformPackages',releasePayload?.platformPackages],
  ]
  for(const [key,approved] of checks){
    if(Object.prototype.hasOwnProperty.call(body||{},key)&&!sameCanonical(body?.[key],approved))problems.push(`${key} differs from approved releasePayload`)
  }
  if(Object.prototype.hasOwnProperty.call(body||{},'description')){
    const approved=releasePayload?.platformPackages?.youtube?.description
    if(!sameCanonical(body?.description,approved))problems.push('description differs from approved YouTube description')
  }
  if(Object.prototype.hasOwnProperty.call(body||{},'privacyLevel')&&!sameCanonical(body?.privacyLevel,releasePayload?.platformPackages?.tiktok?.privacyLevel))problems.push('privacyLevel differs from approved TikTok package')
  if(Object.prototype.hasOwnProperty.call(body||{},'privacyStatus')&&!sameCanonical(body?.privacyStatus,releasePayload?.platformPackages?.youtube?.privacyStatus))problems.push('privacyStatus differs from approved YouTube package')
  if(Object.prototype.hasOwnProperty.call(body||{},'madeForKids')&&!sameCanonical(body?.madeForKids,releasePayload?.platformPackages?.youtube?.madeForKids))problems.push('madeForKids differs from approved YouTube package')
  if(Object.prototype.hasOwnProperty.call(body||{},'isAigc')&&!sameCanonical(body?.isAigc,releasePayload?.platformPackages?.tiktok?.isAigc))problems.push('isAigc differs from approved TikTok package')
  if(Object.prototype.hasOwnProperty.call(body||{},'isAiGeneratedContent')&&!sameCanonical(body?.isAiGeneratedContent,releasePayload?.platformPackages?.youtube?.isAiGeneratedContent))problems.push('isAiGeneratedContent differs from approved YouTube package')
}
function releaseHash(payload:any){return crypto.createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex')}
function approvalKey(contentHash:string,masterHash:string,agentId:string){return `one-million-souls:v59:approval:${contentHash}:${masterHash}:${agentId}`}
function certificateKey(contentHash:string,masterHash:string){return `one-million-souls:v59:certificate:${contentHash}:${masterHash}`}
async function redis(command:any[]){
  if(!redisUrl||!redisToken)throw new Error('DURABLE_RELEASE_STORE_NOT_CONFIGURED')
  const r=await fetch(redisUrl,{method:'POST',headers:{authorization:`Bearer ${redisToken}`,'content-type':'application/json'},body:JSON.stringify(command),cache:'no-store'})
  if(!r.ok)throw new Error(`RELEASE_STORE_HTTP_${r.status}`)
  const data:any=await r.json(); return data?.result
}
async function readJson(key:string){const raw=await redis(['GET',key]); return raw?JSON.parse(raw):null}

async function verify(body:any){
  const agents=await requiredAgents()
  const problems:string[]=[]
  const releasePayload=body?.releasePayload
  if(!releasePayload||typeof releasePayload!=='object')problems.push('immutable releasePayload is required')
  const computed=releasePayload?releaseHash(releasePayload):''
  const contentHash=String(body?.contentHash||'').toLowerCase()
  const masterHash=String(body?.masterHash||'').toLowerCase()
  if(!/^[a-f0-9]{64}$/.test(contentHash))problems.push('valid contentHash is required')
  if(!/^[a-f0-9]{64}$/.test(masterHash))problems.push('valid immutable masterHash is required')
  if(computed&&computed!==contentHash)problems.push('contentHash does not match immutable releasePayload')
  if(releasePayload?.masterHash!==masterHash)problems.push('releasePayload.masterHash mismatch')
  if(body?.mediaUrl&&releasePayload?.mediaUrl!==body.mediaUrl)problems.push('mediaUrl differs from approved releasePayload')
  if(body?.thumbnailUrl&&releasePayload?.thumbnailUrl!==body.thumbnailUrl)problems.push('thumbnailUrl differs from approved releasePayload')
  validateCanonicalRequest(body,releasePayload,problems)
  const scheduled=String(body?.scheduledPublishAt||body?.publishAt||'')
  if(scheduled&&releasePayload?.scheduledPublishAt!==scheduled)problems.push('scheduled publish time differs from approved releasePayload')
  if(problems.length)return {ok:false,problems,contentHash,masterHash}

  const certificate=await readJson(certificateKey(contentHash,masterHash))
  if(!certificate)problems.push('durable professional-master certificate missing')
  else{
    if(certificate.contentHash!==contentHash||certificate.masterHash!==masterHash)problems.push('certificate identity mismatch')
    if(certificate.certification!=='PROFESSIONAL_MASTER_CERTIFIED')problems.push('PROFESSIONAL_MASTER_CERTIFIED required')
    if(certificate.masterReady!==true)problems.push('MASTER_READY certificate required')
    if(certificate.releaseStatus!=='APPROVED_AWAITING_POST_TIME')problems.push('release is not APPROVED_AWAITING_POST_TIME')
    for(const gate of REQUIRED_GATES)if(certificate.qa?.[gate]!=='PASS')problems.push(`QA gate not PASS: ${gate}`)
  }

  const approvals:any={}
  const times:Record<string,number>={}
  for(const agentId of agents){
    approvals[agentId]=await readJson(approvalKey(contentHash,masterHash,agentId))
    const vote=approvals[agentId]
    if(!vote){problems.push(`missing durable approval: ${agentId}`);continue}
    if(vote.decision!=='APPROVE')problems.push(`${agentId} decision is not APPROVE`)
    if(vote.contentHash!==contentHash||vote.masterHash!==masterHash)problems.push(`${agentId} approval identity mismatch`)
    if(!String(vote.evidence||'').trim())problems.push(`${agentId} approval missing evidence`)
    const t=Date.parse(vote.approvedAt||'')
    if(!Number.isFinite(t))problems.push(`${agentId} approval timestamp invalid`); else times[agentId]=t
  }

  const latestOther=Math.max(0,...agents.filter((id)=>id!=='publisher').map((id)=>times[id]||0))
  if(!times.publisher||times.publisher<=latestOther)problems.push('publisher must approve strictly after all 49 prior approvals')
  const releaseReadyAt=Date.parse(certificate?.releaseReadyAt||'')
  const scheduledPublishAt=Date.parse(releasePayload?.scheduledPublishAt||'')
  if(!Number.isFinite(releaseReadyAt))problems.push('certificate releaseReadyAt invalid')
  if(!Number.isFinite(scheduledPublishAt))problems.push('releasePayload scheduledPublishAt invalid')
  if(Number.isFinite(releaseReadyAt)&&Number.isFinite(scheduledPublishAt)&&scheduledPublishAt-releaseReadyAt<2*60*60*1000)problems.push('required 2-hour release-ready buffer not met')
  if(Number.isFinite(releaseReadyAt)&&times.publisher&&releaseReadyAt<times.publisher)problems.push('releaseReadyAt precedes Publisher approval')

  return {ok:problems.length===0,problems,contentHash,masterHash,certificate,requiredApprovals:agents.length,receivedApprovals:agents.filter((id)=>approvals[id]?.decision==='APPROVE').length}
}

export async function POST(req:Request){
  let body:any
  try{body=await req.clone().json()}catch{return NextResponse.json({ok:false,error:'Invalid JSON body'},{status:400})}
  try{
    const check=await verify(body)
    if(!check.ok)return NextResponse.json({ok:false,blocked:true,reason:'DURABLE_PROFESSIONAL_MASTER_CERTIFICATE_REQUIRED',approvalCheck:check},{status:423})
    return corePOST(req)
  }catch(error){
    return NextResponse.json({ok:false,blocked:true,reason:'RELEASE_VERIFICATION_FAILED',error:error instanceof Error?error.message:String(error)},{status:503})
  }
}
