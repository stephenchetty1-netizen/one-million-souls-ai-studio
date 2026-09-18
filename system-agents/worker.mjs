import { setTimeout as sleep } from 'node:timers/promises'
const base=process.env.AUTONOMY_BASE_URL||'http://127.0.0.1:'+(process.env.PORT||3000)
const secret=process.env.CRON_SECRET||''
const provider=Boolean(process.env.OPENAI_API_KEY||process.env.ANTHROPIC_API_KEY||process.env.GEMINI_API_KEY)
async function call(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:body?JSON.stringify(body):undefined})
 const text=await r.text(); if(!r.ok) throw new Error(path+':'+r.status+':'+text.slice(0,300)); return text
}
async function waitReady(){for(let i=0;i<60;i++){try{await call('/api/system-agents/status');return}catch{} await sleep(2000)}throw new Error('APP_NOT_READY')}
async function cycle(){
 const evidence={at:new Date().toISOString(),providerConnected:provider}
 evidence.systemAgents=await call('/api/system-agents/status')
 evidence.contentAgents=await call('/api/content-agents/status')
 // Fail closed: creative/R&D/approval autonomy cannot be claimed without a real reasoning provider.
 if(!provider) throw new Error('AUTONOMY_REASONING_PROVIDER_MISSING')
 // Generate a real plan; approvals remain locked until evaluators submit evidence.
 evidence.plan=await call('/api/content-agents/plan','POST',{mode:'SHORT'})
 return evidence
}
await waitReady()
console.log('AUTONOMY_WORKER_READY',JSON.stringify({base,providerConnected:provider,failClosed:true}))
for(;;){try{const e=await cycle();console.log('AUTONOMY_CYCLE_PASS',JSON.stringify(e))}catch(err){console.error('AUTONOMY_CYCLE_BLOCKED',JSON.stringify({at:new Date().toISOString(),error:String(err?.message||err)}))}await sleep(120000)}
