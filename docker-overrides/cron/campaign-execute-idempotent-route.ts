import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { POST as campaignPOST } from '@/app/api/campaign/execute/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const redisUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, '')
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
const LOCK_TTL_SECONDS = 36 * 60 * 60

async function claim(key:string) {
  if (!redisUrl || !redisToken) return { ok:false, reason:'DURABLE_IDEMPOTENCY_STORE_NOT_CONFIGURED' }
  const response = await fetch(redisUrl, {
    method:'POST',
    headers:{ authorization:`Bearer ${redisToken}`, 'content-type':'application/json' },
    body:JSON.stringify(['SET', key, new Date().toISOString(), 'NX', 'EX', LOCK_TTL_SECONDS]),
    cache:'no-store',
  })
  if (!response.ok) return { ok:false, reason:`IDEMPOTENCY_STORE_HTTP_${response.status}` }
  const data:any = await response.json()
  return data?.result === 'OK' ? { ok:true } : { ok:false, reason:'ALREADY_EXECUTED_OR_IN_PROGRESS' }
}

export async function POST(req:Request) {
  let body:any
  try { body = await req.clone().json() }
  catch { return NextResponse.json({ok:false,error:'Invalid JSON body'},{status:400}) }
  const scheduledSlot = String(body?.scheduledSlot || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledSlot)) {
    return NextResponse.json({ok:false,blocked:true,reason:'VALID_SCHEDULED_SLOT_REQUIRED'},{status:400})
  }
  const masterIdentity = String(body?.masterHash || body?.contentHash || 'campaign')
  const digest = crypto.createHash('sha256').update(`${scheduledSlot}|${masterIdentity}`).digest('hex')
  const lockKey = `one-million-souls:v59:slot-execution:${digest}`
  const lock = await claim(lockKey)
  if (!lock.ok) {
    const duplicate = lock.reason === 'ALREADY_EXECUTED_OR_IN_PROGRESS'
    return NextResponse.json({ok:duplicate,executed:false,duplicate,reason:lock.reason,scheduledSlot},{status:duplicate ? 200 : 503})
  }
  return campaignPOST(req)
}
