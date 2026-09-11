import { NextRequest, NextResponse } from 'next/server'
import { buildVideoAssemblyManifest, validateVideoAssemblyManifest } from '@/lib/video-assembly'
export const runtime='nodejs'
export async function POST(req:NextRequest){
  const secret=process.env.CRON_SECRET
  if(!secret || req.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401})
  try{
    const body=await req.json()
    if(!body?.jobId || !body?.productionPlan || !body?.creativeAssetBundle) return NextResponse.json({ok:false,error:'jobId, productionPlan and creativeAssetBundle are required.'},{status:400})
    const manifest=buildVideoAssemblyManifest(body)
    const validation=validateVideoAssemblyManifest(manifest)
    return NextResponse.json({ok:validation.valid,manifest,validation},{status:validation.valid?200:422})
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Video assembly planning failed.'},{status:500})}
}
