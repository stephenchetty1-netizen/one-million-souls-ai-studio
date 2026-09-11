import { NextRequest, NextResponse } from 'next/server'
import { buildSourceHierarchy, EvidenceItem } from '@/lib/source-hierarchy'
import { redisSetJson, redisGetJson } from '@/lib/jobs'

function auth(req: NextRequest) { return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}` }
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ok:false,error:'Unauthorized'}, {status:401})
  const body = await req.json()
  const result = buildSourceHierarchy(body)
  await redisSetJson('one-million-souls:knowledge:source-hierarchy:latest', result, 86400 * 30)
  return NextResponse.json({ok:true, hierarchy:result})
}
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ok:false,error:'Unauthorized'}, {status:401})
  const hierarchy = await redisGetJson('one-million-souls:knowledge:source-hierarchy:latest')
  return NextResponse.json({ok:true, hierarchy})
}
