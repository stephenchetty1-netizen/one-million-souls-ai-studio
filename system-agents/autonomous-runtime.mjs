import { SYSTEM_REPAIR_AGENTS, runSystemRepairTeam } from './system-agent-team.mjs'

export const AUTONOMY = Object.freeze({
  mode:'24X7_FAIL_CLOSED',
  loops:{
    research:{ intervalMs:15*60_000 },
    production:{ intervalMs:5*60_000 },
    approvals:{ intervalMs:2*60_000 },
    repair:{ intervalMs:60_000 },
    analytics:{ intervalMs:15*60_000 },
  },
  releaseSlots:['08:00','15:30','20:30'],
  timezone:'Africa/Johannesburg',
})

const sleep = ms => new Promise(r=>setTimeout(r,ms))

export async function startAutonomousRuntime(adapters={}) {
  const required=['research','production','approvals','repair','analytics']
  const missing=required.filter(k=>typeof adapters[k] !== 'function')
  if (missing.length) throw new Error('AUTONOMY_ADAPTERS_MISSING:'+missing.join(','))
  const run = async (name,ms) => {
    for (;;) {
      const startedAt=new Date().toISOString()
      try {
        const result=await adapters[name]({startedAt,autonomy:AUTONOMY})
        console.log('AUTONOMY_CYCLE',JSON.stringify({name,startedAt,ok:result?.passed===true,evidence:result?.evidence||null}))
      } catch(error) {
        console.error('AUTONOMY_CYCLE_ERROR',JSON.stringify({name,startedAt,error:error instanceof Error?error.message:String(error)}))
      }
      await sleep(ms)
    }
  }
  return Promise.all(Object.entries(AUTONOMY.loops).map(([name,cfg])=>run(name,cfg.intervalMs)))
}

export function autonomyReadiness(adapters={}) {
  const names=['research','production','approvals','repair','analytics']
  const connected=Object.fromEntries(names.map(n=>[n,typeof adapters[n]==='function']))
  return {ready:Object.values(connected).every(Boolean),connected,repairAgents:SYSTEM_REPAIR_AGENTS.length,mode:AUTONOMY.mode}
}
