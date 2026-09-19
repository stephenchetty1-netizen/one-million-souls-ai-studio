import { NextResponse } from 'next/server'
import { getAutonomousGrowthBotStatus } from '../../../../system-agents/autonomous-growth-bots.mjs'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function authorized(req:Request){
  const secret=process.env.CRON_SECRET||''
  return Boolean(secret)&&req.headers.get('authorization')===`Bearer ${secret}`
}
export async function GET(req:Request){
  if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const status=await getAutonomousGrowthBotStatus()
  return NextResponse.json({
    ok:true,
    ...status,
    capabilities:{
      ongoingGrowthResearch:true,
      independentCloudComputers:false,
      independentExternalLogins:false,
      artificialEngagement:false,
      paidAi:false,
      publisherPermissions:false,
    }
  })
}
