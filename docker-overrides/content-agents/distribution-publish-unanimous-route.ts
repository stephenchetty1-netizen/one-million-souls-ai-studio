import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { POST as corePOST } from '@/app/api/distribution/publish-core/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const REQUIRED_AGENTS = ["trend-scout","million-view-scout","channel-strategist","competitor-mapper","search-intent-analyst","audience-insight-researcher","retention-scientist","hook-lab","format-innovation-lab","thumbnail-researcher","metadata-strategist","content-portfolio-planner","executive-producer","storyboard-producer","media-producer","motion-editor","sound-designer","repurposing-editor","media-librarian","production-scheduler","rights-scout","theology-guard","script-writer","asset-scout","music-director","visual-director","thumbnail-director","content-director","shorts-editor","longform-producer","lyric-producer","qa","publisher","analytics-learner"]
const REQUIRED_GATES = [
  'rightsStatus','theologyStatus','factualStatus','mediaIntegrity','captionSync',
  'audioMix','visualQuality','thumbnailQuality','contentQuality','lyricSync','originality'
]

function canonicalize(value:any):any {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => key !== 'approvalEnvelope')
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    )
  }
  return value
}

function payloadHash(body:any) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(canonicalize(body)))
    .digest('hex')
}

function verify(body:any) {
  const envelope = body?.approvalEnvelope || {}
  const approvals = envelope.approvals || {}
  const hash = payloadHash(body)
  const problems:string[] = []
  const times:Record<string,number> = {}

  if (envelope.contentHash !== hash) problems.push('contentHash mismatch')

  for (const agentId of REQUIRED_AGENTS) {
    const vote = approvals[agentId]
    if (!vote) { problems.push(`missing approval: ${agentId}`); continue }
    if (vote.decision !== 'APPROVE') problems.push(`${agentId} decision is not APPROVE`)
    if (vote.contentHash !== hash) problems.push(`${agentId} approval is stale`)
    const t = Date.parse(vote.approvedAt || '')
    if (!Number.isFinite(t)) problems.push(`${agentId} approval has invalid approvedAt`)
    else times[agentId] = t
    if (!String(vote.evidence || vote.notes || '').trim()) problems.push(`${agentId} approval missing evidence`)
  }

  const publisherTime = times.publisher || 0
  const latestOther = Math.max(0, ...REQUIRED_AGENTS.filter((id)=>id!=='publisher').map((id)=>times[id]||0))
  if (!publisherTime || publisherTime < latestOther) problems.push('publisher must approve last')

  for (const gate of REQUIRED_GATES) {
    if ((envelope.qa || {})[gate] !== 'PASS') problems.push(`QA gate not PASS: ${gate}`)
  }

  return {ok:problems.length===0,contentHash:hash,requiredApprovals:REQUIRED_AGENTS.length,problems}
}

export async function POST(req:Request) {
  let body:any
  try { body = await req.clone().json() }
  catch { return NextResponse.json({ok:false,error:'Invalid JSON body'},{status:400}) }

  const check = verify(body)
  if (!check.ok) {
    return NextResponse.json({
      ok:false,blocked:true,reason:'UNANIMOUS_TEAM_APPROVAL_REQUIRED',approvalCheck:check
    },{status:423})
  }
  return corePOST(req)
}
