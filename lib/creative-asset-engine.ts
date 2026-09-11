import OpenAI from 'openai'

export type GeneratedVisual = { id:string; scene:number; kind:'visual'|'cover'; mimeType:'image/png'; dataBase64:string; prompt:string }
export type GeneratedVoice = { scene:number; mimeType:'audio/mpeg'; dataBase64:string; text:string }
export type CreativeAssetBundle = {
  version:'V24'
  status:'GENERATED'|'PLANNED'
  visuals:GeneratedVisual[]
  voice:GeneratedVoice[]
  provider:{image:'openai-gpt-image-2'|'external-renderer'; speech:'openai-gpt-4o-mini-tts'|'external-renderer'}
  guardrails:string[]
}

const clean=(v:string,n:number)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n)

function enabled(){ return process.env.CREATIVE_ASSETS_ENABLED === 'true' }
function client(){ if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.'); return new OpenAI({apiKey:process.env.OPENAI_API_KEY}) }

export async function generateCreativeAssets(plan:any):Promise<CreativeAssetBundle>{
  const scenes=Array.isArray(plan?.scenes)?plan.scenes.slice(0,6):[]
  const guardrails=[
    'Use only generated, owned, licensed, public-domain or platform-cleared media.',
    'Never fabricate Scripture text inside generated imagery.',
    'Never clone or imitate a real person’s voice.',
    'Do not generate copyrighted song lyrics or unlicensed music.',
    'Keep Jesus, verified Scripture and the approved message central.',
  ]
  if(!enabled()) return {version:'V24',status:'PLANNED',visuals:[],voice:[],provider:{image:'external-renderer',speech:'external-renderer'},guardrails}

  const openai=client()
  const visuals:GeneratedVisual[]=[]
  for(const s of scenes){
    const prompt=clean(`Vertical 9:16 cinematic Christian social-media visual. ${s.visualPrompt||s.visual||''}. Respectful, modern, emotionally hopeful. No text, no fake Bible verses, no logos, no watermarks.`,1400)
    const r=await openai.images.generate({model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-2',prompt,size:'1024x1536',quality:'high'})
    const b64=(r as any).data?.[0]?.b64_json
    if(!b64) throw new Error(`Image generation failed for scene ${s.scene}.`)
    visuals.push({id:`scene-${s.scene}`,scene:s.scene,kind:'visual',mimeType:'image/png',dataBase64:b64,prompt})
  }
  if(plan?.coverConcept){
    const prompt=clean(`Vertical 9:16 Christian short-form cover image. ${plan.coverConcept}. Bold focal composition, cinematic, clean, no text, no fake Scripture, no logo, no watermark.`,1400)
    const r=await openai.images.generate({model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-2',prompt,size:'1024x1536',quality:'high'})
    const b64=(r as any).data?.[0]?.b64_json
    if(b64) visuals.push({id:'cover',scene:0,kind:'cover',mimeType:'image/png',dataBase64:b64,prompt})
  }

  const voice:GeneratedVoice[]=[]
  for(const s of scenes){
    const text=clean(s.narration,2200)
    if(!text) continue
    const audio=await openai.audio.speech.create({model:process.env.OPENAI_TTS_MODEL||'gpt-4o-mini-tts',voice:process.env.OPENAI_TTS_VOICE||'coral',input:text,instructions:'Warm, sincere, clear Christian devotional narration. Natural pacing, compassionate tone, no impersonation of a real person.'})
    const buffer=Buffer.from(await audio.arrayBuffer())
    voice.push({scene:s.scene,mimeType:'audio/mpeg',dataBase64:buffer.toString('base64'),text})
  }
  return {version:'V24',status:'GENERATED',visuals,voice,provider:{image:'openai-gpt-image-2',speech:'openai-gpt-4o-mini-tts'},guardrails}
}


export async function generateVoiceOnly(scenes:any[]):Promise<GeneratedVoice[]> {
  if(!enabled()) return []
  const openai=client()
  const voice:GeneratedVoice[]=[]
  for(const s of (Array.isArray(scenes)?scenes.slice(0,6):[])){
    const text=clean(s.narration,2200)
    if(!text) continue
    const audio=await openai.audio.speech.create({model:process.env.OPENAI_TTS_MODEL||'gpt-4o-mini-tts',voice:process.env.OPENAI_TTS_VOICE||'coral',input:text,instructions:'Warm, sincere, clear Christian devotional narration. Natural pacing, compassionate tone, no impersonation of a real person.'})
    const buffer=Buffer.from(await audio.arrayBuffer())
    voice.push({scene:s.scene,mimeType:'audio/mpeg',dataBase64:buffer.toString('base64'),text})
  }
  return voice
}

export function validateCreativeAssetBundle(bundle:CreativeAssetBundle, expectedScenes:number){
  const errors:string[]=[]
  if(bundle.version!=='V24') errors.push('Unsupported creative asset version.')
  if(bundle.status==='GENERATED'){
    if(bundle.visuals.filter(x=>x.kind==='visual').length!==expectedScenes) errors.push('Generated visual count does not match scene count.')
    if(bundle.voice.length!==expectedScenes) errors.push('Generated voice count does not match scene count.')
    if(bundle.visuals.some(x=>!x.dataBase64)) errors.push('Missing generated image data.')
    if(bundle.voice.some(x=>!x.dataBase64)) errors.push('Missing generated voice data.')
  }
  return {valid:errors.length===0,errors}
}
