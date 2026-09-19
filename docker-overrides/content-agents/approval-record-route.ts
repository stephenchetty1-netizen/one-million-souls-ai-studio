import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const redisUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, '')
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') || ''
  return auth === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}
async function policy() {
  return JSON.parse(await fs.readFile(path.join(process.cwd(),'content-agents','approval-policy.json'),'utf8'))
}
function cleanHash(v:any) { return /^[a-f0-9]{64}$/i.test(String(v||'')) ? String(v).toLowerCase() : '' }
function key(contentHash:string,masterHash:string,agentId:string) { return `one-million-souls:v59:approval:${contentHash}:${masterHash}:${agentId}` }
function certificateKey(contentHash:string,masterHash:string) { return `one-million-souls:v59:certificate:${contentHash}:${masterHash}` }
async function redis(command:any[]) {
  if (!redisUrl || !redisToken) throw new Error('DURABLE_APPROVAL_STORE_NOT_CONFIGURED')
  const r=await fetch(redisUrl,{method:'POST',headers:{authorization:`Bearer ${redisToken}`,'content-type':'application/json'},body:JSON.stringify(command),cache:'no-store'})
  if(!r.ok) throw new Error(`APPROVAL_STORE_HTTP_${r.status}`)
  const data:any=await r.json(); return data?.result
}
async function readVote(contentHash:string,masterHash:string,agentId:string) {
  const raw=await redis(['GET',key(contentHash,masterHash,agentId)])
  return raw ? JSON.parse(raw) : null
}
async function writeVote(record:any) {
  await redis(['SET',key(record.contentHash,record.masterHash,record.agentId),JSON.stringify(record)])
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const body:any=await req.json().catch(()=>null)
  if(!body) return NextResponse.json({ok:false,error:'Invalid JSON body'},{status:400})
  const p=await policy(); const required:string[]=p.requiredAgents||[]
  const agentId=String(body.agentId||''), contentHash=cleanHash(body.contentHash), masterHash=cleanHash(body.masterHash)
  const evidence=String(body.evidence||body.notes||'').trim(), decision=String(body.decision||'').toUpperCase()
  if(!required.includes(agentId)) return NextResponse.json({ok:false,error:'Unknown approval agent'},{status:400})
  if(!contentHash||!masterHash) return NextResponse.json({ok:false,error:'Valid contentHash and masterHash required'},{status:400})
  if(!['APPROVE','REVISE','BLOCK'].includes(decision)) return NextResponse.json({ok:false,error:'Decision must be APPROVE, REVISE, or BLOCK'},{status:400})
  if(!evidence) return NextResponse.json({ok:false,error:'Evidence/notes required'},{status:400})
  try {
    let publisherApprovedAt=''
    if(agentId==='publisher'&&decision==='APPROVE') {
      const missing:string[]=[]
      let latestPrior=0
      for(const id of required.filter((x)=>x!=='publisher')) {
        const vote=await readVote(contentHash,masterHash,id)
        if(!vote||vote.decision!=='APPROVE'||vote.contentHash!==contentHash||vote.masterHash!==masterHash) missing.push(id)
        else {
          const t=Date.parse(vote.approvedAt||'')
          if(!Number.isFinite(t)) missing.push(id)
          else latestPrior=Math.max(latestPrior,t)
        }
      }
      if(missing.length) return NextResponse.json({ok:false,blocked:true,error:'Publisher approval requires all 49 prior approvals with valid timestamps',missing:[...new Set(missing)]},{status:423})
      publisherApprovedAt=new Date(Math.max(Date.now(),latestPrior+1)).toISOString()
    }
    const record={recordId:crypto.randomUUID(),agentId,decision,contentHash,masterHash,approvedAt:publisherApprovedAt||new Date().toISOString(),evidence}
    await writeVote(record)
    return NextResponse.json({ok:true,publishingLocked:true,durable:true,record})
  } catch(error) {
    return NextResponse.json({ok:false,blocked:true,error:error instanceof Error?error.message:'approval store failed'},{status:503})
  }
}

export async function GET(req: Request) {
  if(!authorized(req)) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const url=new URL(req.url)
  const contentHash=cleanHash(url.searchParams.get('contentHash'))
  const masterHash=cleanHash(url.searchParams.get('masterHash'))
  if(!contentHash||!masterHash) return NextResponse.json({ok:false,error:'Valid contentHash and masterHash required'},{status:400})
  const p=await policy(); const required:string[]=p.requiredAgents||[]; const approvals:any={}
  try {
    for(const id of required) approvals[id]=await readVote(contentHash,masterHash,id)||{agentId:id,decision:'PENDING',contentHash,masterHash,approvedAt:null,evidence:''}
    const rawCertificate=await redis(['GET',certificateKey(contentHash,masterHash)])
    const certificate=rawCertificate?JSON.parse(rawCertificate):null
    const unanimous=required.every((id)=>approvals[id]?.decision==='APPROVE'&&approvals[id]?.contentHash===contentHash&&approvals[id]?.masterHash===masterHash)
    return NextResponse.json({ok:true,publishingLocked:!unanimous,durable:true,contentHash,masterHash,approvals,certificate,releaseStatus:certificate?.releaseStatus||'RETURN_TO_PRODUCTION',certification:certificate?.certification||'NOT_CERTIFIED'})
  } catch(error) {
    return NextResponse.json({ok:false,blocked:true,error:error instanceof Error?error.message:'approval store failed'},{status:503})
  }
}
