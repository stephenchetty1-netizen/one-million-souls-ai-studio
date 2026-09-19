import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { runCertificationCycle } from '../content-agents/certification-runner.mjs'
import { durableRedis } from '../content-agents/durable-redis.mjs'
import { runYoutubeGrowthScan } from '../content-agents/youtube-growth-swarm.mjs'

const base=process.env.AUTONOMY_BASE_URL||'http://127.0.0.1:'+(process.env.PORT||3000)
const secret=process.env.CRON_SECRET||''
const provider=Boolean(process.env.OPENAI_API_KEY||process.env.ANTHROPIC_API_KEY||process.env.GEMINI_API_KEY)
const growthIntervalMs=Math.max(6,Number(process.env.YOUTUBE_GROWTH_INTERVAL_HOURS||6))*60*60*1000
let lastGrowthScanAt=0
let redisVerified=false

if (process.argv.includes('--with-app')) {
  console.log('V59_AUTONOMY_SUPERVISOR '+JSON.stringify({mode:'24X7',failClosed:true,worker:'enabled',entrypoint:'npm-start'}))
  const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start'],{stdio:'inherit',env:process.env})
  app.on('error',e=>{ console.error('APP_SPAWN_ERROR',e.message); process.exit(1) })
  app.on('exit',code=>process.exit(code??1))
  for (const sig of ['SIGTERM','SIGINT']) process.on(sig,()=>app.kill(sig))
}

async function call(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:body?JSON.stringify(body):undefined})
 const text=await r.text(); if(!r.ok) throw new Error(path+':'+r.status+':'+text.slice(0,300)); return text
}
async function waitReady(){for(let i=0;i<60;i++){try{await call('/api/system-agents/autonomy-status');return}catch{} await sleep(2000)}throw new Error('APP_NOT_READY')}
async function verifyRedis(){
 if(redisVerified)return {ok:true,cached:true}
 const key=`one-million-souls:v59:selftest:${process.pid}:${Date.now()}`
 const value=`ready:${Date.now()}`
 const set=await durableRedis(['SET',key,value,'EX','60'])
 if(set!=='OK')throw new Error('DURABLE_REDIS_SELFTEST_SET_FAILED')
 const got=await durableRedis(['GET',key])
 await durableRedis(['DEL',key])
 if(got!==value)throw new Error('DURABLE_REDIS_SELFTEST_READ_MISMATCH')
 redisVerified=true
 console.log('DURABLE_REDIS_READY',JSON.stringify({ok:true,transport:process.env.REDIS_URL?'redis-url-resp':'rest-fallback'}))
 return {ok:true,cached:false}
}
async function cycle(){
 const evidence={at:new Date().toISOString(),providerConnected:provider}
 evidence.redis=await verifyRedis()
 evidence.systemAgents=await call('/api/system-agents/autonomy-status')
 evidence.contentAgents=await call('/api/content-agents/status')
 if(Date.now()-lastGrowthScanAt>=growthIntervalMs){
   try{
     evidence.youtubeGrowth=await runYoutubeGrowthScan()
     lastGrowthScanAt=Date.now()
     console.log('YOUTUBE_GROWTH_SCAN',JSON.stringify(evidence.youtubeGrowth))
   }catch(error){
     evidence.youtubeGrowth={ok:false,error:String(error?.message||error),zeroCreditOnly:true}
     console.error('YOUTUBE_GROWTH_SCAN_BLOCKED',JSON.stringify(evidence.youtubeGrowth))
   }
 }
 if(!provider&&process.env.ZERO_CREDIT_ONLY!=='true') throw new Error('AUTONOMY_REASONING_PROVIDER_MISSING')
 const planText=await call('/api/content-agents/plan','POST',{mode:'SHORT'})
 evidence.plan=planText
 const parsed=JSON.parse(planText)
 const plan=parsed?.plan
 if(!plan?.publishingLocked || plan?.requiredApprovals!==50) throw new Error('AUTONOMY_PLAN_FAIL_CLOSED_POLICY_INVALID')
 // Certification is allowed only from a real immutable renderer master plus measured,
 // multimodal QA evidence. The runner processes at most one pending master per cycle.
 const certification=await runCertificationCycle()
 evidence.certification=certification
 evidence.releaseState={
   publishingLocked:certification?.execution?.certification!=='PROFESSIONAL_MASTER_CERTIFIED',
   requiredApprovals:plan.requiredApprovals,
   nextAction:certification?.execution?.releaseStatus==='APPROVED_AWAITING_POST_TIME'
     ? 'AWAIT_SCHEDULED_POST_TIME'
     : plan.nextAction,
   reason:certification?.execution?.certification==='PROFESSIONAL_MASTER_CERTIFIED'
     ? 'EXACT_MASTER_CERTIFIED_AND_QUEUED'
     : (certification?.reason||certification?.stage||'NO_CERTIFIED_MASTER_THIS_CYCLE')
 }
 return evidence
}
await waitReady()
console.log('AUTONOMY_WORKER_READY',JSON.stringify({base,providerConnected:provider,failClosed:true}))
for(;;){try{const e=await cycle();console.log('AUTONOMY_CYCLE_PASS',JSON.stringify(e))}catch(err){console.error('AUTONOMY_CYCLE_BLOCKED',JSON.stringify({at:new Date().toISOString(),error:String(err?.message||err)}))}await sleep(120000)}
