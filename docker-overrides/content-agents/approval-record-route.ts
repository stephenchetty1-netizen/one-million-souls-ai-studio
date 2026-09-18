import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const body:any = await req.json().catch(()=>null)
  if (!body) return NextResponse.json({ok:false,error:'Invalid JSON body'},{status:400})
  const p = await policy()
  const required:string[] = p.requiredAgents || []
  const agentId = String(body.agentId||'')
  const contentHash = cleanHash(body.contentHash)
  const masterHash = cleanHash(body.masterHash)
  const evidence = String(body.evidence||body.notes||'').trim()
  const decision = String(body.decision||'').toUpperCase()
  if (!required.includes(agentId)) return NextResponse.json({ok:false,error:'Unknown approval agent'},{status:400})
  if (!contentHash || !masterHash) return NextResponse.json({ok:false,error:'Valid contentHash and masterHash required'},{status:400})
  if (!['APPROVE','REVISE','BLOCK'].includes(decision)) return NextResponse.json({ok:false,error:'Decision must be APPROVE, REVISE, or BLOCK'},{status:400})
  if (!evidence) return NextResponse.json({ok:false,error:'Evidence/notes required'},{status:400})

  const root = process.env.APPROVAL_STORE_DIR || '/tmp/v59-approval-records'
  const dir = path.join(root, contentHash)
  await fs.mkdir(dir,{recursive:true})
  const publisher = agentId === 'publisher'
  if (publisher && decision === 'APPROVE') {
    const others = required.filter((id)=>id!=='publisher')
    const missing:string[] = []
    for (const id of others) {
      try {
        const vote = JSON.parse(await fs.readFile(path.join(dir,`${id}.json`),'utf8'))
        if (vote.decision !== 'APPROVE' || vote.contentHash !== contentHash || vote.masterHash !== masterHash) missing.push(id)
      } catch { missing.push(id) }
    }
    if (missing.length) return NextResponse.json({ok:false,blocked:true,error:'Publisher approval requires all 49 prior approvals',missing},{status:423})
  }

  const record = {
    recordId: crypto.randomUUID(), agentId, decision, contentHash, masterHash,
    approvedAt: new Date().toISOString(), evidence
  }
  const target = path.join(dir,`${agentId}.json`)
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp,JSON.stringify(record,null,2))
  await fs.rename(tmp,target)
  return NextResponse.json({ok:true,publishingLocked:true,record})
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const contentHash = cleanHash(new URL(req.url).searchParams.get('contentHash'))
  if (!contentHash) return NextResponse.json({ok:false,error:'Valid contentHash required'},{status:400})
  const p = await policy(); const required:string[] = p.requiredAgents || []
  const dir = path.join(process.env.APPROVAL_STORE_DIR || '/tmp/v59-approval-records',contentHash)
  const approvals:any = {}
  for (const id of required) {
    try { approvals[id] = JSON.parse(await fs.readFile(path.join(dir,`${id}.json`),'utf8')) }
    catch { approvals[id] = {agentId:id,decision:'PENDING',contentHash,approvedAt:null,evidence:''} }
  }
  return NextResponse.json({ok:true,publishingLocked:true,contentHash,approvals})
}
