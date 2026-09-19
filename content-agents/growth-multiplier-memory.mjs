import { durableRedis } from './durable-redis.mjs'

const KEY='one-million-souls:growth-multiplier:state:v1'
const MAX_DECISIONS=120
const MAX_WINNERS=60

function safeJson(v,f){try{return v?JSON.parse(v):f}catch{return f}}
function now(){return new Date().toISOString()}
export function emptyGrowthMultiplierState(){
  return {version:1,updatedAt:null,decisions:[],winners:[],rescues:[],retired:[]}
}
export async function loadGrowthMultiplierState(){
  try{
    const raw=await durableRedis(['GET',KEY])
    return {...emptyGrowthMultiplierState(),...safeJson(raw,{})}
  }catch(error){
    return {...emptyGrowthMultiplierState(),persistenceWarning:error instanceof Error?error.message:String(error)}
  }
}
export async function saveGrowthMultiplierState(state){
  const next={...emptyGrowthMultiplierState(),...state,updatedAt:now()}
  await durableRedis(['SET',KEY,JSON.stringify(next)])
  return next
}
export async function rememberGrowthDecisions(decisions=[]){
  const state=await loadGrowthMultiplierState()
  const tagged=decisions.map(x=>({...x,recordedAt:x.recordedAt||now()}))
  const next={
    ...state,
    decisions:[...tagged,...(state.decisions||[])].slice(0,MAX_DECISIONS),
    winners:[...tagged.filter(x=>x.classification==='WINNER'),...(state.winners||[])].slice(0,MAX_WINNERS),
    rescues:[...tagged.filter(x=>x.classification==='RESCUE'),...(state.rescues||[])].slice(0,MAX_WINNERS),
    retired:[...tagged.filter(x=>x.classification==='RETIRE'),...(state.retired||[])].slice(0,MAX_WINNERS),
  }
  try{return await saveGrowthMultiplierState(next)}
  catch(error){return {...next,persistenceWarning:error instanceof Error?error.message:String(error)}}
}
