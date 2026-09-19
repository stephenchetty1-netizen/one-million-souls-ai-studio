import OpenAI from 'openai'
import fs from 'node:fs/promises'
import path from 'node:path'

const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY})
const model=process.env.AUTONOMY_MODEL||'gpt-5-mini'
const audioModel=process.env.AUDIO_REVIEW_MODEL||'gpt-audio-1.5'

const REQUIRED_EVIDENCE=[
 'fullWatch','technicalMaster','creativeMaster','rightsManifest','thumbnailInspection',
 'metadataInspection','theologyInspection','factualInspection','scriptureContextInspection',
 'safeZoneInspection','exportInspection','masterIntegrityInspection','captionInspection',
 'audioInspection','voicePerformanceInspection','visualQualityInspection','frameQualityInspection',
 'contentQualityInspection','originalityInspection','professionalExecutionInspection',
 'platformPackagingInspection','lyricInspection'
]
const VISUAL_AGENTS=new Set([
 'visual-concept-designer','broll-sequence-designer','caption-design-editor','platform-packaging-producer',
 'visual-realism-auditor','frame-quality-inspector','mobile-safe-zone-inspector','export-encoding-inspector',
 'master-integrity-auditor','thumbnail-researcher','thumbnail-director','visual-director','motion-editor',
 'shorts-editor','qa'
])
const AUDIO_AGENTS=new Set([
 'voice-performance-director','audio-mastering-auditor','music-director','sound-designer'
])

function decisionFrom(text){
 const m=String(text||'').match(/\b(APPROVE|REVISE|BLOCK)\b/i)
 return m?m[1].toUpperCase():'BLOCK'
}
async function audioBytes(master){
 const url=master?.reviewAssets?.audioReviewUrl
 if(!url)throw new Error('AUDIO_REVIEW_URL_MISSING')
 const r=await fetch(url,{redirect:'follow'})
 if(!r.ok)throw new Error(`AUDIO_REVIEW_HTTP_${r.status}`)
 return Buffer.from(await r.arrayBuffer())
}
function promptFor(agentId,contentHash,masterHash,master,evidence){
 return {
  agentId,contentHash,masterHash,master,evidence,standard:'PROFESSIONAL_MASTER',
  instruction:'Act only as the named release reviewer. This is a RELEASE vote, not a development review. Evaluate the exact immutable contentHash/masterHash and the measured evidence. Never approve a prompt, storyboard, specification, draft, or component asset as though it were the final master. Never invent missing evidence. Return exactly one of APPROVE, REVISE, or BLOCK near the start, followed by concise specific evidence in your remit. APPROVE only if the exact master meets PROFESSIONAL_MASTER in your assigned remit. Quality outranks schedule or quota.'
 }
}

async function textVote(agentId,payload){
 const r=await client.responses.create({model,input:JSON.stringify(payload),max_output_tokens:500})
 return String(r.output_text||'').trim()
}
async function visualVote(agentId,payload,master){
 const urls=[
  master?.reviewAssets?.firstFrameUrl,
  master?.reviewAssets?.contactSheetUrl,
  master?.reviewAssets?.lastFrameUrl,
  master?.thumbnailUrl,
 ].filter(Boolean)
 if(urls.length<4)return 'BLOCK - Exact first/contact/final/thumbnail visual evidence is incomplete.'
 const content=[
  {type:'input_text',text:JSON.stringify(payload)},
  ...urls.map((image_url)=>({type:'input_image',image_url})),
 ]
 const r=await client.responses.create({model,input:[{role:'user',content}],max_output_tokens:650})
 return String(r.output_text||'').trim()
}
async function audioVote(agentId,payload,bytes){
 const r=await client.chat.completions.create({
  model:audioModel,
  messages:[{role:'user',content:[
   {type:'text',text:JSON.stringify(payload)},
   {type:'input_audio',input_audio:{data:bytes.toString('base64'),format:'mp3'}},
  ]}],
  max_tokens:650,
 })
 return String(r.choices?.[0]?.message?.content||'').trim()
}

export async function evaluateMaster({contentHash,masterHash,master,evidence}){
 if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY_MISSING')
 if(!/^[a-f0-9]{64}$/i.test(contentHash)||!/^[a-f0-9]{64}$/i.test(masterHash))throw new Error('INVALID_MASTER_IDENTITY')
 if(!master||!evidence)throw new Error('REAL_MASTER_AND_MEASURED_EVIDENCE_REQUIRED')
 const missingEvidence=REQUIRED_EVIDENCE.filter((key)=>!evidence?.[key])
 if(missingEvidence.length)throw new Error('MASTER_READY_EVIDENCE_MISSING:'+missingEvidence.join(','))
 const failedEvidence=REQUIRED_EVIDENCE.filter((key)=>evidence?.[key]?.status!=='PASS')
 if(failedEvidence.length)throw new Error('PROFESSIONAL_MASTER_EVIDENCE_NOT_PASS:'+failedEvidence.join(','))

 const policy=JSON.parse(await fs.readFile(path.join(process.cwd(),'content-agents','approval-policy.json'),'utf8'))
 const decisions={}
 let audio=null
 for(const agentId of policy.requiredAgents){
  if(agentId==='publisher')continue
  const payload=promptFor(agentId,contentHash,masterHash,master,evidence)
  let text=''
  try{
   if(AUDIO_AGENTS.has(agentId)){
    if(!audio)audio=await audioBytes(master)
    text=await audioVote(agentId,payload,audio)
   }else if(VISUAL_AGENTS.has(agentId)){
    text=await visualVote(agentId,payload,master)
   }else{
    text=await textVote(agentId,payload)
   }
  }catch(error){
   text=`BLOCK - Reviewer execution failed closed for ${agentId}: ${error instanceof Error?error.message:String(error)}`
  }
  const decision=decisionFrom(text)
  decisions[agentId]={decision,evidence:text||'BLOCK - No usable evaluator evidence returned.'}
  if(decision!=='APPROVE'){
   console.warn('MASTER_AGENT_NONAPPROVAL',JSON.stringify({agentId,decision,contentHash,masterHash,evidence:String(text).slice(0,500)}))
  }
 }
 const nonPublisher=policy.requiredAgents.filter((x)=>x!=='publisher')
 const all49=nonPublisher.length===49&&nonPublisher.every((id)=>decisions[id]?.decision==='APPROVE')
 decisions.publisher=all49
  ? {decision:'APPROVE',evidence:'APPROVE - Publisher last. All 49 prior named release reviewers approved this exact immutable contentHash/masterHash with evidence. Publisher made no repairs, substitutions, recompression, metadata edits, or asset changes.'}
  : {decision:'BLOCK',evidence:'BLOCK - Publisher cannot approve because one or more of the 49 prior named release reviewers did not APPROVE this exact immutable contentHash/masterHash.'}
 return {contentHash,masterHash,decisions,all49Approved:all49}
}
