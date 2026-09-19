import { NextResponse } from 'next/server'
import { autonomyReadiness, AUTONOMY } from '../../../../system-agents/autonomous-runtime.mjs'
export const runtime='nodejs'; export const dynamic='force-dynamic'
export async function GET(){
 const provider=Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY)
 const zeroCreditOnly=process.env.ZERO_CREDIT_ONLY==='true'
 // Adapter registration is NOT evidence of a working renderer, durable approvals,
 // a certified exact master, or a successfully deployed publishing pipeline.
 const localAutonomy=zeroCreditOnly||provider
 const adapters={
  research:localAutonomy?()=>{}:undefined,
  production:localAutonomy?()=>{}:undefined,
  approvals:localAutonomy?()=>{}:undefined,
  repair:()=>{},
  analytics:()=>{},
 }
 const readiness=autonomyReadiness(adapters)
 return NextResponse.json({
  ok:true,
  ...readiness,
  readinessScope:'ADAPTER_CONFIGURATION_ONLY',
  releaseReady:false,
  releaseReadiness:'UNVERIFIED',
  publishingLocked:true,
  rendererVerified:false,
  exactMasterCertified:false,
  durableFiftyApprovalsVerified:false,
  providerConnected:provider,
  providerRequired:!zeroCreditOnly,
  zeroCreditOnly,
  certificationMode:zeroCreditOnly?'DETERMINISTIC_MEASURED_EXACT_MASTER':'PROVIDER_ASSISTED',
  autonomy:AUTONOMY,
 })
}
