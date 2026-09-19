import fs from 'node:fs/promises'
import path from 'node:path'

function words(value){
  return new Set(String(value||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x=>x.length>2))
}
function similarity(a,b){
  const aa=words(a),bb=words(b)
  if(!aa.size||!bb.size)return 0
  let common=0
  for(const x of aa)if(bb.has(x))common++
  return common/(aa.size+bb.size-common)
}
async function loadCards(){
  try{
    const raw=await fs.readFile(path.join(process.cwd(),'content-agents','channel-attraction-cards.json'),'utf8')
    return JSON.parse(raw)
  }catch{return {drawCards:[],rotationRules:{}}}
}
function evidenceBoost(card,opportunities){
  let best=0
  for(const op of opportunities||[]){
    const topic=String(op?.topic||'')
    const need=(card.viewerNeed||[]).join(' ')
    const score=Number(op?.opportunityScore||0)
    const sim=Math.max(similarity(topic,need),similarity(topic,card.name||''),similarity(topic,card.promise||''))
    best=Math.max(best,sim*(score||50))
  }
  return best
}
function fatiguePenalty(card,recentTopics=[]){
  const hay=[card.name,card.promise,...(card.viewerNeed||[])].join(' ')
  let max=0
  for(const item of recentTopics||[]){
    const topic=String(item?.topic||item?.key||item||'')
    max=Math.max(max,similarity(hay,topic))
  }
  return max>=0.75?25:max>=0.5?12:0
}
function platformFit(card,platform){
  const p=card?.[platform]||{}
  let score=10
  if(p.format)score+=5
  if(platform==='youtube'&&/playlist|longer|long-form|companion|series/i.test(JSON.stringify(p)))score+=5
  if(platform==='tiktok'&&/direct|20-|30-|45|loop|reply|camera-facing|short/i.test(JSON.stringify(p)))score+=5
  return score
}
export async function recommendChannelAttractions({platform,opportunities=[],recentTopics=[],metrics={}}={}){
  const library=await loadCards()
  const cards=(library.drawCards||[]).map(card=>{
    const evidence=evidenceBoost(card,opportunities)
    const fatigue=fatiguePenalty(card,recentTopics)
    const fit=platformFit(card,platform)
    const returnPotential=/series|daily|morning|night|question|part|tomorrow|next/i.test(JSON.stringify(card))?10:5
    const score=Math.round(Math.max(0,Math.min(100,35+evidence*0.35+fit+returnPotential-fatigue)))
    return {
      id:card.id,
      name:card.name,
      promise:card.promise,
      attractionScore:score,
      decision:score>=70?'FEATURE':score>=55?'ROTATE_TEST':'HOLD',
      platformPackage:card?.[platform]||{},
      hookPatterns:(card.hookPatterns||[]).slice(0,3),
      guardrails:card.guardrails||[],
    }
  }).sort((a,b)=>b.attractionScore-a.attractionScore)
  const featured=cards.filter(x=>x.decision==='FEATURE').slice(0,4)
  const rotation=cards.filter(x=>x.decision!=='HOLD').slice(0,7)
  return {
    platform,
    generatedAt:new Date().toISOString(),
    zeroCreditOnly:true,
    featured,
    rotation,
    rules:{
      ...(library.rotationRules||{}),
      note:'Underlying concept can cross platforms, but hook, pacing, packaging, CTA and duration must be rebuilt per platform.'
    },
    measuredContext:metrics,
  }
}
