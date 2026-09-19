import { NextResponse } from 'next/server'
import { getRetentionExperimentLedger } from '../../../../content-agents/v60-experiment-ledger.mjs'
import { loadVerifiedPerformance } from '../../../../content-agents/verified-performance-evidence.mjs'
import { planRetentionExperiments } from '../../../../content-agents/v60-retention-experiments.mjs'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function authorized(req:Request){
  const secret=process.env.CRON_SECRET||''
  return Boolean(secret)&&req.headers.get('authorization')===`Bearer ${secret}`
}
export async function GET(req:Request){
  if(!authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  try{
    const plans=[]
    for(const platform of ['youtube','tiktok']){
      const [ledger,evidence]=await Promise.all([
        getRetentionExperimentLedger(platform,{limit:20}),
        loadVerifiedPerformance(platform),
      ])
      const current=planRetentionExperiments({platform,evidence})
      plans.push({
        platform,
        latestMeasuredCaptureAt:evidence.capturedAt,
        measuredSource:evidence.source||null,
        measuredPostCount:evidence.measuredPostCount||0,
        freshness:evidence.freshness,
        currentProposalStatus:current.status,
        currentProposals:current.experiments,
        savedLedger:ledger,
      })
    }
    return NextResponse.json({
      ok:true,phase:'V60_GROWTH_OPTIMIZATION',
      zeroCreditOnly:process.env.ZERO_CREDIT_ONLY==='true',
      readOnly:true,publishingLocked:true,publishingAuthority:false,
      templateReviewRequired:true,
      note:'Experiment proposals are not rendered, reviewed or certified videos.',
      platforms:plans,
    })
  }catch(error){
    return NextResponse.json({ok:false,error:String((error as Error)?.message||error)},{status:503})
  }
}
