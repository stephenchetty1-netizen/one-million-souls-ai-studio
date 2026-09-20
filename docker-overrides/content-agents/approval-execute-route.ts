import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { durableRedis } from '@/content-agents/durable-redis.mjs'
import { evaluateMaster } from '@/content-agents/master-evaluator.mjs'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

function authorized(req:Request){
 const s=process.env.CRON_SECRET
 if(!s)return false
 const a=req.headers.get('authorization')||''
 return a===`Bearer ${s}`||req.headers.get('x-cron-secret')===s
}
async function policy(){return JSON.parse(await fs.readFile(path.join(process.cwd(),'content-agents','approval-policy.json'),'utf8'))}
function hash(v:any){return /^[a-f0-9]{64}$/i.test(String(v||''))?String(v).toLowerCase():''}
function canonicalize(value:any):any{
 if(Array.isArray(value))return value.map(canonicalize)
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonicalize(value[key])]))
 return value
}
function releaseHash(payload:any){return crypto.createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex')}
const redis=durableRedis
function certificateKey(contentHash:string,masterHash:string){return `one-million-souls:v59:certificate:${contentHash}:${masterHash}`}

export async function POST(req:Request){
 if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
 const body:any=await req.json().catch(()=>null)
 if(!body)return NextResponse.json({ok:false,error:'Invalid JSON body'},{status:400})
 const contentHash=hash(body.contentHash),masterHash=hash(body.masterHash)
 if(!contentHash||!masterHash)return NextResponse.json({ok:false,error:'Valid contentHash and masterHash required'},{status:400})
 const evidence=body.evidence
 if(!evidence||typeof evidence!=='object')return NextResponse.json({ok:false,blocked:true,error:'Measured evidence bundle required; executor will not synthesize approvals'},{status:423})
 const requiredEvidence=['fullWatch','technicalMaster','creativeMaster','rightsManifest','thumbnailInspection','metadataInspection','theologyInspection','factualInspection','scriptureContextInspection','safeZoneInspection','exportInspection','masterIntegrityInspection','captionInspection','audioInspection','voicePerformanceInspection','visualQualityInspection','frameQualityInspection','contentQualityInspection','originalityInspection','professionalExecutionInspection','platformPackagingInspection','lyricInspection']
 const missingEvidence=requiredEvidence.filter((key)=>!evidence?.[key])
 if(missingEvidence.length)return NextResponse.json({ok:false,blocked:true,error:'MASTER_READY_EVIDENCE_MISSING',missingEvidence},{status:423})
 const requiredPassEvidence=requiredEvidence
 if(requiredPassEvidence.some((key)=>evidence?.[key]?.status!=='PASS'))
   return NextResponse.json({ok:false,blocked:true,error:'PROFESSIONAL_MASTER_REQUIRES_ALL_EVIDENCE_PASS',failed:requiredPassEvidence.filter((key)=>evidence?.[key]?.status!=='PASS')},{status:423})
 const master=body.master
 if(!master||typeof master!=='object'||!master.releasePayload||typeof master.releasePayload!=='object')
   return NextResponse.json({ok:false,blocked:true,error:'Immutable final master bundle with releasePayload required'},{status:423})
 if(body.decisions!==undefined)
   return NextResponse.json({ok:false,blocked:true,error:'CALLER_DECISIONS_NOT_ACCEPTED: approval decisions are computed inside the executor from the exact master and evidence'},{status:423})
 if(releaseHash(master.releasePayload)!==contentHash)
   return NextResponse.json({ok:false,blocked:true,error:'contentHash does not match immutable master.releasePayload'},{status:423})
 if(String(master.releasePayload.masterHash||'').toLowerCase()!==masterHash)
   return NextResponse.json({ok:false,blocked:true,error:'master.releasePayload.masterHash mismatch'},{status:423})
 const evaluation=await evaluateMaster({contentHash,masterHash,master,evidence})
 const decisions=evaluation?.decisions
 if(!decisions||typeof decisions!=='object')
   return NextResponse.json({ok:false,blocked:true,error:'Internal master evaluation returned no decisions'},{status:503})
 const p=await policy(); const required:string[]=p.requiredAgents||[]
 const base=new URL(req.url); const endpoint=new URL('/api/content-agents/approval-record',base)
 const secret=process.env.CRON_SECRET!
 const results:any[]=[]
 for(const agentId of required){
   const d=decisions[agentId]
   if(!d)return NextResponse.json({ok:false,blocked:true,error:`Missing decision for ${agentId}`,completed:results.length},{status:423})
   const decision=String(d.decision||'').toUpperCase()
   const notes=String(d.evidence||d.notes||'').trim()
   if(!['APPROVE','REVISE','BLOCK'].includes(decision)||!notes)
     return NextResponse.json({ok:false,blocked:true,error:`Invalid decision/evidence for ${agentId}`,completed:results.length},{status:423})
   const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-cron-secret':secret},body:JSON.stringify({agentId,decision,contentHash,masterHash,evidence:notes})})
   const data:any=await r.json().catch(()=>({ok:false,error:'Invalid approval-record response'}))
   results.push({agentId,status:r.status,ok:!!data.ok,decision})
   if(!r.ok)return NextResponse.json({ok:false,blocked:true,error:`Approval recording stopped at ${agentId}`,results,detail:data},{status:423})
 }
 const unanimous=results.length===required.length&&results.every((x)=>x.ok&&x.decision==='APPROVE')
 let certificate:any=null
 if(unanimous){
   const releaseReadyAt=new Date().toISOString()
   const qa={
     rightsStatus:evidence.rightsManifest.status,
     theologyStatus:evidence.theologyInspection.status,
     factualStatus:evidence.factualInspection.status,
     mediaIntegrity:evidence.masterIntegrityInspection.status,
     captionSync:evidence.captionInspection.status,
     audioMix:evidence.audioInspection.status,
     visualQuality:evidence.visualQualityInspection.status,
     thumbnailQuality:evidence.thumbnailInspection.status,
     contentQuality:evidence.contentQualityInspection.status,
     lyricSync:evidence.lyricInspection.status,
     originality:evidence.originalityInspection.status,
     professionalExecution:evidence.professionalExecutionInspection.status,
     technicalMaster:evidence.technicalMaster.status,
     creativeMaster:evidence.creativeMaster.status,
   }
   certificate={
     certificateId:crypto.randomUUID(),reviewStandardVersion:'v59-independent-exact-master-v2',
     contentHash,masterHash,masterReady:true,
     certification:'PROFESSIONAL_MASTER_CERTIFIED',releaseStatus:'APPROVED_AWAITING_POST_TIME',
     releaseReadyAt,issuedAt:releaseReadyAt,requiredApprovals:required.length,qa,
     evidenceDigest:crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex')
   }
   await redis(['SET',certificateKey(contentHash,masterHash),JSON.stringify(certificate)])
 }
 return NextResponse.json({ok:true,publishingLocked:!unanimous,contentHash,masterHash,recorded:results.length,results,masterReady:unanimous,all49Approved:evaluation?.all49Approved===true,reviewEngine:evaluation?.reviewEngine||null,decisions,certification:unanimous?'PROFESSIONAL_MASTER_CERTIFIED':'NOT_CERTIFIED',releaseStatus:unanimous?'APPROVED_AWAITING_POST_TIME':'RETURN_TO_PRODUCTION',certificate})
}
