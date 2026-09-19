import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { listGrowthCandidates } from '../../../../content-agents/growth-candidate-queue.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') || ''
  const xSecret = req.headers.get('x-cron-secret') || ''
  return auth === `Bearer ${secret}` || xSecret === secret
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 })
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'content-agents', 'seed-queue.json'), 'utf8')
    const growthCandidates = await listGrowthCandidates(30)
    return NextResponse.json({ ok:true, publishingLocked:true, queue:JSON.parse(raw), growthCandidates, growthCandidateCount:growthCandidates.length })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'queue failed' }, { status:500 })
  }
}
