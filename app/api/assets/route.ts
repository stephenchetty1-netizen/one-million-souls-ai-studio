import { NextRequest, NextResponse } from 'next/server'
import { buildAssetVoiceManifest, validateAssetVoiceManifest } from '@/lib/asset-voice-engine'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ ok:false, error:'Unauthorized.' }, {status:401})
  try { const body = await req.json(); const manifest=buildAssetVoiceManifest(body?.productionPlan || body); const validation=validateAssetVoiceManifest(manifest); return NextResponse.json({ok:validation.valid,manifest,validation},{status:validation.valid?200:422}) }
  catch(e){ return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Asset planning failed.'},{status:500}) }
}
