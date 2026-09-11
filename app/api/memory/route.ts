import { NextRequest, NextResponse } from 'next/server'
import { buildAgentMemorySnapshot, saveAgentMemorySnapshot, validateAgentMemorySnapshot } from '@/lib/agent-memory'
function authorized(req: NextRequest) { const secret = process.env.CRON_SECRET; return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`) }
export async function GET(req: NextRequest) { if (!authorized(req)) return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401}); return NextResponse.json({ok:true,snapshot:await buildAgentMemorySnapshot()}) }
export async function POST(req: NextRequest) { if (!authorized(req)) return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401}); const snapshot=await buildAgentMemorySnapshot(); if(!validateAgentMemorySnapshot(snapshot)) return NextResponse.json({ok:false,error:'Memory validation failed.'},{status:422}); await saveAgentMemorySnapshot(snapshot); return NextResponse.json({ok:true,snapshot}) }
