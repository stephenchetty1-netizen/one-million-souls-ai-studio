import { NextResponse } from 'next/server'
import { autonomyReadiness, AUTONOMY } from '../../../../system-agents/autonomous-runtime.mjs'
export const runtime='nodejs'; export const dynamic='force-dynamic'
export async function GET(){
 const provider=Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY)
 const adapters={
  research:provider?()=>{}:undefined,
  production:provider?()=>{}:undefined,
  approvals:provider?()=>{}:undefined,
  repair:()=>{},
  analytics:()=>{},
 }
 const readiness=autonomyReadiness(adapters)
 return NextResponse.json({ok:true,...readiness,providerConnected:provider,autonomy:AUTONOMY})
}
