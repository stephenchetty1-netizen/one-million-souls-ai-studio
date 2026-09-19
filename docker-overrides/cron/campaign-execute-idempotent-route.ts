import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { POST as campaignPOST } from '@/app/api/campaign/execute/route'
import { durableRedis } from '@/content-agents/durable-redis.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LOCK_TTL_SECONDS = 36 * 60 * 60

const redis=durableRedis

async function claim(key:string) {
  try { const result=await redis(['SET',key,new Date().toISOString(),'NX','EX',LOCK_TTL_SECONDS]); return result==='OK'?{ok:true}:{ok:false,reason:'ALREADY_EXECUTED_OR_IN_PROGRESS'} }
  catch(e){ return {ok:false,reason:e instanceof Error?e.message:String(e)} }
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
  try {
    const response = await campaignPOST(req)
    if (!response.ok) await redis(['DEL',lockKey]).catch(()=>null)
    return response
  } catch (error) {
    await redis(['DEL',lockKey]).catch(()=>null)
    throw error
  }
}
