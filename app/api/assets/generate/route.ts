import { NextRequest, NextResponse } from 'next/server'
import { generateCreativeAssets, validateCreativeAssetBundle } from '@/lib/creative-asset-engine'
export const runtime='nodejs'
export async function POST(req:NextRequest){
  const secret=process.env.CRON_SECRET
  if(!secret || req.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401})
  try{
    const body=await req.json()
    if(!body?.productionPlan) return NextResponse.json({ok:false,error:'productionPlan is required.'},{status:400})
    const scenes=Array.isArray(body.productionPlan.scenes)?body.productionPlan.scenes.slice(0,6):[]
    const bundle=await generateCreativeAssets(body.productionPlan)
    const validation=validateCreativeAssetBundle(bundle,scenes.length)
    return NextResponse.json({ok:validation.valid,bundle,validation},{status:validation.valid?200:422})
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Creative asset generation failed.'},{status:500})}
}
