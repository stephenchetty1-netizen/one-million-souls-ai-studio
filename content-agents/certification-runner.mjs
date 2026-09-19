import OpenAI from 'openai'
import crypto from 'node:crypto'
import { zeroCreditPreflight } from './zero-credit-review.mjs'
import { durableRedis } from './durable-redis.mjs'

const zeroCreditOnly=process.env.ZERO_CREDIT_ONLY!=='false'
let client=null
function openaiClient(){
 if(!client)client=new OpenAI({apiKey:process.env.OPENAI_API_KEY})
 return client
}
const visualModel=process.env.MASTER_REVIEW_MODEL||process.env.AUTONOMY_MODEL||'gpt-5-mini'
const audioModel=process.env.AUDIO_REVIEW_MODEL||'gpt-audio-1.5'
const timezone=process.env.APP_TIMEZONE||'Africa/Johannesburg'
const v59Base=(process.env.AUTONOMY_BASE_URL||`http://127.0.0.1:${process.env.PORT||3000}`).replace(/\/$/,'')
function normalizeBaseUrl(value){
  const raw=String(value||'').trim().replace(/\/$/,'')
  if(!raw)return ''
  return /^https?:\/\//i.test(raw)?raw:`https://${raw}`
}
const rendererBase=normalizeBaseUrl(
  process.env.RAILWAY_SERVICE_ONE_MILLION_SOULS_VIDEO_RENDERER_URL||
  process.env.VIDEO_RENDER_WEBHOOK_URL||
  ''
)
const cronSecret=process.env.CRON_SECRET||''
const renderSecret=process.env.VIDEO_RENDER_SECRET||''
const advanceDays=Math.max(2,Number(process.env.CONTENT_BUFFER_DAYS||7))
const reviewBackoffUntil=new Map()
const CERTIFICATE_REQUIRED_GATES=Object.freeze([
  'rightsStatus','theologyStatus','factualStatus','mediaIntegrity','captionSync','audioMix',
  'visualQuality','thumbnailQuality','contentQuality','lyricSync','originality',
  'professionalExecution','technicalMaster','creativeMaster'
])


function certificateKey(contentHash,masterHash){
  return `one-million-souls:v59:certificate:${contentHash}:${masterHash}`
}
async function releaseReadinessSummary(){
  if(!rendererBase)throw new Error('RENDERER_BASE_URL_MISSING')
  const summary={days:advanceDays,expected:advanceDays*3,total:0,certified:0,awaiting:0,deadlineMissed:0,productionRetry:0,invalid:0,allCertified:false,issues:[],nextDayPackages:[]}
  const issue=(value)=>{if(summary.issues.length<20)summary.issues.push(value)}
  for(let day=1;day<=advanceDays;day++){
    const date=futureDate(day)
    let manifest
    try{manifest=await fetchJson(`${rendererBase}/factory-manifest?date=${date}`,renderSecret)}
    catch(error){summary.invalid++;issue({date,reason:'MANIFEST_UNAVAILABLE',error:error instanceof Error?error.message:String(error)});continue}
    const entries=Array.isArray(manifest?.entries)?manifest.entries:[]
    if(entries.length!==3){summary.invalid++;issue({date,reason:'EXPECTED_THREE_SLOTS',count:entries.length})}
    for(const entry of entries){
      summary.total++
      const identityOk=validHash(entry?.contentHash)&&validHash(entry?.masterHash)&&entry?.releasePayload?.masterHash===entry?.masterHash
      if(entry?.releaseStatus==='PRODUCTION_RETRY'||entry?.renderQualityGate!=='PASS'){
        summary.productionRetry++;issue({date,slot:entry?.slot,title:entry?.title,reason:'PRODUCTION_RETRY_OR_RENDER_BLOCK'});continue
      }
      if(!identityOk){
        summary.invalid++;issue({date,slot:entry?.slot,title:entry?.title,reason:'INVALID_RELEASE_IDENTITY'});continue
      }
      let certificate=null
      try{
        const raw=await durableRedis(['GET',certificateKey(String(entry.contentHash).toLowerCase(),String(entry.masterHash).toLowerCase())])
        certificate=raw?JSON.parse(raw):null
      }catch(error){
        summary.invalid++;issue({date,slot:entry?.slot,title:entry?.title,reason:'CERTIFICATE_STORE_READ_FAILED',error:error instanceof Error?error.message:String(error)});continue
      }
      const qaPass=CERTIFICATE_REQUIRED_GATES.every((gate)=>certificate?.qa?.[gate]==='PASS')
      const exact=certificate?.reviewStandardVersion==='v59-independent-exact-master-v2'&&certificate?.contentHash=String(entry.contentHash).toLowerCase()&&certificate?.masterHash===String(entry.masterHash).toLowerCase()&&certificate?.certification==='PROFESSIONAL_MASTER_CERTIFIED'&&certificate?.masterReady===true&&certificate?.releaseStatus==='APPROVED_AWAITING_POST_TIME'&&qaPass
      if(exact){
        if(day===1){
          let approval=null
          try{approval=await approvalState(entry)}
          catch(error){
            summary.invalid++
            issue({date,slot:entry?.slot,title:entry?.title,reason:'NEXT_DAY_DURABLE_APPROVAL_READ_FAILED',error:error instanceof Error?error.message:String(error)})
            continue
          }
          const approvalExact=approval?.publishingLocked===false&&approval?.certification==='PROFESSIONAL_MASTER_CERTIFIED'&&approval?.releaseStatus==='APPROVED_AWAITING_POST_TIME'&&approval?.certificate?.certificateId===certificate?.certificateId
          if(!approvalExact){
            summary.invalid++
            issue({date,slot:entry?.slot,title:entry?.title,reason:'NEXT_DAY_DURABLE_50_APPROVAL_VALIDATION_FAILED'})
            continue
          }
          summary.nextDayPackages.push({
            targetDate:date,
            slot:entry?.slot,
            title:entry?.title,
            contentHash:String(entry.contentHash).toLowerCase(),
            masterHash:String(entry.masterHash).toLowerCase(),
            certificateId:certificate?.certificateId||null,
            releaseStatus:certificate?.releaseStatus,
            requiredApprovals:50,
            durableApprovalValidated:true,
            releasePayload:entry?.releasePayload,
          })
        }
        summary.certified++
        continue
      }
      summary.awaiting++
      const deadline=Date.parse(entry?.releaseReadyDeadline||'')
      if(Number.isFinite(deadline)&&Date.now()>=deadline){
        summary.deadlineMissed++;issue({date,slot:entry?.slot,title:entry?.title,reason:'RELEASE_READY_DEADLINE_MISSED',releaseReadyDeadline:entry.releaseReadyDeadline})
      }
    }
  }
  summary.allCertified=summary.total===summary.expected&&summary.certified===summary.expected&&summary.awaiting===0&&summary.deadlineMissed===0&&summary.productionRetry===0&&summary.invalid===0
  return summary
}

function futureDate(days=1){
  const d=new Date(Date.now()+days*24*60*60*1000)
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d)
  const m=Object.fromEntries(parts.map((p)=>[p.type,p.value]))
  return `${m.year}-${m.month}-${m.day}`
}
function validHash(v){return /^[a-f0-9]{64}$/i.test(String(v||''))}
function normalizeStatus(v){
  const s=String(v||'').toUpperCase()
  return ['PASS','REVISE','BLOCK'].includes(s)?s:'BLOCK'
}
function jsonFromText(text){
  const raw=String(text||'').trim().replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'')
  const first=raw.indexOf('{'),last=raw.lastIndexOf('}')
  if(first<0||last<first)throw new Error('REVIEW_JSON_MISSING')
  return JSON.parse(raw.slice(first,last+1))
}
async function fetchJson(url,secret=''){
  const headers={}
  if(secret)headers.authorization=`Bearer ${secret}`
  const r=await fetch(url,{headers,cache:'no-store'})
  const data=await r.json().catch(()=>null)
  if(!r.ok)throw new Error(`HTTP_${r.status}:${data?.error||url}`)
  return data
}
async function postJson(url,body,secret=''){
  const headers={'content-type':'application/json'}
  if(secret)headers.authorization=`Bearer ${secret}`
  const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)})
  const data=await r.json().catch(()=>null)
  if(!r.ok)throw new Error(`HTTP_${r.status}:${data?.error||data?.reason||url}`)
  return data
}
async function fetchBytes(url){
  const r=await fetch(url,{redirect:'follow'})
  if(!r.ok)throw new Error(`ASSET_HTTP_${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex')}

function objectiveTechnical(entry){
  const sceneMotion=Array.isArray(entry?.sceneMotionInspection)&&entry.sceneMotionInspection.length>=3&&entry.sceneMotionInspection.every((x)=>x?.passed===true)
  const exportPass=entry?.masterInspection?.passed===true&&entry?.fullDecodeInspection?.passed===true&&
    Number(entry?.width)>=1080&&Number(entry?.height)>=1920&&Number(entry?.fps)>=30
  const pass=exportPass&&entry?.audioInspection?.passed===true&&entry?.captionInspection?.passed===true&&
    entry?.visualVarietyInspection?.passed===true&&sceneMotion&&entry?.professionalMasterCandidate===true
  return {
    status:pass?'PASS':'BLOCK',
    notes:pass
      ? 'Renderer technical gates PASS: final immutable master decodes end-to-end, export profile is at least 1080x1920@30fps, audio/captions/visual-variety and all motion-scene inspections pass.'
      : 'One or more renderer technical gates are below PASS.',
    source:{
      masterInspection:entry?.masterInspection,
      fullDecodeInspection:entry?.fullDecodeInspection,
      audioInspection:entry?.audioInspection,
      captionInspection:entry?.captionInspection,
      visualVarietyInspection:entry?.visualVarietyInspection,
      sceneMotionInspection:entry?.sceneMotionInspection,
    },
  }
}

function rightsEvidence(entry){
  const scenes=Array.isArray(entry?.rightsClearedStockScenes)?entry.rightsClearedStockScenes:[]
  const allScenes=Number(entry?.sceneCount)>0&&scenes.length===Number(entry.sceneCount)&&scenes.every((x)=>
    String(x?.license||'').trim()&&String(x?.sourcePage||'').startsWith('http')&&String(x?.rightsNote||'').trim()
  )
  const voice=entry?.voiceRights||{}
  const music=entry?.musicRights||{}
  const voicePass=String(voice.license||'').toLowerCase()==='apache-2.0'&&/kokoro/i.test(String(voice.model||entry?.voiceProvider||''))
  const musicPass=String(music.license||'').toUpperCase()==='CC0-1.0'&&String(music.sourcePage||'').startsWith('http')
  const pass=allScenes&&voicePass&&musicPass
  return {
    status:pass?'PASS':'BLOCK',
    notes:pass
      ? 'Every visual scene has explicit rights provenance; narration uses Kokoro under Apache-2.0; music has explicit CC0-1.0 provenance.'
      : 'Rights provenance is incomplete or not approved for one or more final-master components.',
    scenes,voice,music,
  }
}

async function verifyIntegrity(entry){
  if(!entry?.mediaUrl||!entry?.thumbnailUrl||!entry?.reviewAssets?.audioReviewUrl)throw new Error('MASTER_REVIEW_ASSETS_MISSING')
  const [master,thumb,audio,first,contact,last]=await Promise.all([
    fetchBytes(entry.mediaUrl),
    fetchBytes(entry.thumbnailUrl),
    fetchBytes(entry.reviewAssets.audioReviewUrl),
    fetchBytes(entry.reviewAssets.firstFrameUrl),
    fetchBytes(entry.reviewAssets.contactSheetUrl),
    fetchBytes(entry.reviewAssets.lastFrameUrl),
  ])
  const actual={
    masterHash:sha(master),
    thumbnailHash:sha(thumb),
    audioReviewHash:sha(audio),
    firstFrameHash:sha(first),
    contactSheetHash:sha(contact),
    lastFrameHash:sha(last),
  }
  const expected={
    masterHash:String(entry.masterHash||'').toLowerCase(),
    thumbnailHash:String(entry.thumbnailHash||'').toLowerCase(),
    audioReviewHash:String(entry.reviewAssets.audioReviewHash||'').toLowerCase(),
    firstFrameHash:String(entry.reviewAssets.firstFrameHash||'').toLowerCase(),
    contactSheetHash:String(entry.reviewAssets.contactSheetHash||'').toLowerCase(),
    lastFrameHash:String(entry.reviewAssets.lastFrameHash||'').toLowerCase(),
  }
  const pass=Object.keys(expected).every((k)=>validHash(expected[k])&&actual[k]===expected[k])
  return {
    status:pass?'PASS':'BLOCK',
    notes:pass
      ? 'Remote immutable MP4, thumbnail, mixed-audio review and temporal visual review assets all re-hash exactly to their recorded SHA-256 identities.'
      : 'One or more remote review/master assets do not match recorded SHA-256 identity.',
    actual,expected,
    audioBytes:audio,
  }
}

async function visualReview(entry,technical,rights){
  const required=[
    'creativeMaster','thumbnailInspection','metadataInspection','theologyInspection','factualInspection',
    'visualQualityInspection','contentQualityInspection','originalityInspection','professionalExecutionInspection',
    'platformPackagingInspection','scriptureContextInspection','frameQualityInspection'
  ]
  const prompt={
    task:'Strict PROFESSIONAL_MASTER release preflight for One Million Souls. Return JSON only.',
    immutableIdentity:{contentHash:entry.contentHash,masterHash:entry.masterHash,thumbnailHash:entry.thumbnailHash},
    releasePayload:entry.releasePayload,
    objectiveTechnical:technical,
    rightsSummary:{status:rights.status,notes:rights.notes},
    reviewMethod:entry.reviewAssets?.method,
    temporalCoverage:entry.reviewAssets?.temporalCoverage,
    rules:[
      'Judge the supplied immutable final-master review images, not a prompt or storyboard.',
      'The contact sheet samples the final master across its full duration; first and final frames are separately supplied.',
      'BLOCK or REVISE obvious AI anatomy/motion artifacts, malformed faces/hands/text, flicker-like inconsistency, irrelevant/repeated B-roll, weak visual progression, cluttered captions, misleading thumbnail, poor hook/payoff, theological misuse, factual error, manipulative/prosperity-gospel claims, or metadata that misrepresents the actual piece.',
      'Do not claim a global plagiarism search. Originality may PASS only for no obvious imitation/copying visible in supplied material plus recorded rights/original-script provenance.',
      'Quality outranks posting cadence. When uncertain, REVISE or BLOCK.',
      'Every requested key must be an object with status PASS|REVISE|BLOCK and concise notes.'
    ],
    requiredKeys:required,
  }
  const content=[
    {type:'input_text',text:JSON.stringify(prompt)},
    {type:'input_image',image_url:entry.reviewAssets.firstFrameUrl},
    {type:'input_image',image_url:entry.reviewAssets.contactSheetUrl},
    {type:'input_image',image_url:entry.reviewAssets.lastFrameUrl},
    {type:'input_image',image_url:entry.thumbnailUrl},
  ]
  const r=await openaiClient().responses.create({model:visualModel,input:[{role:'user',content}],max_output_tokens:1800})
  const parsed=jsonFromText(r.output_text)
  const out={}
  for(const key of required){
    out[key]={
      status:normalizeStatus(parsed?.[key]?.status),
      notes:String(parsed?.[key]?.notes||'Reviewer returned no usable notes').slice(0,1200),
    }
  }
  return out
}

async function audioReview(entry,audioBytes){
  const prompt={
    task:'Strict PROFESSIONAL_MASTER audio release review. Listen to the exact final mixed master audio. Return JSON only.',
    immutableIdentity:{contentHash:entry.contentHash,masterHash:entry.masterHash,audioReviewHash:entry.reviewAssets.audioReviewHash},
    script:entry.releasePayload?.script,
    objectiveAudio:entry.audioInspection,
    requirements:{
      audioInspection:'Judge intelligibility, clipping/distortion, voice/music balance, distracting artifacts and professional mix.',
      voicePerformanceInspection:'Judge naturalness, pacing, emphasis, pronunciation, emotional fit, robotic delivery and listener fatigue.',
    },
    rule:'Quality outranks schedule. Use PASS, REVISE or BLOCK. Do not invent unheard evidence.',
  }
  const completion=await openaiClient().chat.completions.create({
    model:audioModel,
    messages:[{role:'user',content:[
      {type:'text',text:JSON.stringify(prompt)},
      {type:'input_audio',input_audio:{data:audioBytes.toString('base64'),format:'mp3'}},
    ]}],
    max_tokens:900,
  })
  const parsed=jsonFromText(completion.choices?.[0]?.message?.content||'')
  return {
    audioInspection:{
      status:normalizeStatus(parsed?.audioInspection?.status),
      notes:String(parsed?.audioInspection?.notes||'Audio reviewer returned no usable notes').slice(0,1200),
      objective:entry.audioInspection,
    },
    voicePerformanceInspection:{
      status:normalizeStatus(parsed?.voicePerformanceInspection?.status),
      notes:String(parsed?.voicePerformanceInspection?.notes||'Voice reviewer returned no usable notes').slice(0,1200),
    },
  }
}

function aggregateEvidence(entry,technical,rights,integrity,visual,audio){
  const captionPass=entry?.captionInspection?.passed===true
  const safePass=captionPass&&Number(entry?.captionInspection?.horizontalSafeMargin)>=80&&Number(entry?.captionInspection?.bottomSafeMargin)>=150
  const exportPass=entry?.masterInspection?.passed===true&&entry?.fullDecodeInspection?.passed===true
  const visualStatuses=[
    visual.creativeMaster,visual.visualQualityInspection,visual.frameQualityInspection,
    visual.contentQualityInspection,visual.professionalExecutionInspection,
  ].map((x)=>x?.status)
  const creativePass=visualStatuses.every((x)=>x==='PASS')&&audio.audioInspection.status==='PASS'&&audio.voicePerformanceInspection.status==='PASS'
  const fullWatchPass=entry?.fullDecodeInspection?.passed===true&&visual.creativeMaster.status==='PASS'&&audio.audioInspection.status==='PASS'
  const evidence={
    fullWatch:{
      status:fullWatchPass?'PASS':'BLOCK',
      notes:fullWatchPass
        ? (zeroCreditOnly
          ? 'Zero-credit full-master verification PASS: the exact final MP4 was decoded end-to-end from first to last frame, every scene passed motion/black/freeze checks, temporal first/contact/final assets were hash-verified, and the exact final mixed audio passed objective loudness/peak/integrity checks. No claim of human or paid-AI perceptual viewing/listening is made.'
          : 'Exact final MP4 was decoded end-to-end from first to last frame; uniformly sampled temporal contact sheet plus first/final frames were visually reviewed; exact final mixed audio was separately listened to.')
        : 'End-to-end decode, temporal visual verification, or exact mixed-audio verification did not fully PASS.',
    },
    technicalMaster:technical,
    creativeMaster:{
      status:creativePass?'PASS':'BLOCK',
      notes:creativePass
        ? (zeroCreditOnly
          ? 'Zero-credit creative master gates PASS using exact curated-content identity, measured real-motion/frame integrity, immutable packaging, caption/safe-zone checks, audio mastering metrics, Kokoro provenance and speaking-rate proxy. No human or paid-AI subjective quality review is claimed.'
          : 'Visual storytelling, frame quality, content execution, exact final audio and voice performance all PASS.')
        : 'One or more creative/master experience gates require revision or are blocked.',
    },
    rightsManifest:rights,
    thumbnailInspection:visual.thumbnailInspection,
    metadataInspection:visual.metadataInspection,
    theologyInspection:visual.theologyInspection,
    factualInspection:visual.factualInspection,
    scriptureContextInspection:visual.scriptureContextInspection,
    safeZoneInspection:{
      status:safePass?'PASS':'BLOCK',
      notes:safePass?'Caption safe-zone measurements meet mobile release minimums.':'Caption mobile safe-zone evidence is below release requirement.',
      source:entry.captionInspection,
    },
    exportInspection:{
      status:exportPass?'PASS':'BLOCK',
      notes:exportPass?'Final master export inspection and full end-to-end decode PASS.':'Final export or end-to-end decode failed.',
      source:{masterInspection:entry.masterInspection,fullDecodeInspection:entry.fullDecodeInspection},
    },
    masterIntegrityInspection:{status:integrity.status,notes:integrity.notes,actual:integrity.actual,expected:integrity.expected},
    captionInspection:{
      status:captionPass?'PASS':'BLOCK',
      notes:captionPass?'Rendered captions passed cadence and measured safe-zone inspection.':'Rendered caption inspection failed.',
      source:entry.captionInspection,
    },
    audioInspection:audio.audioInspection,
    voicePerformanceInspection:audio.voicePerformanceInspection,
    visualQualityInspection:visual.visualQualityInspection,
    frameQualityInspection:visual.frameQualityInspection,
    contentQualityInspection:visual.contentQualityInspection,
    originalityInspection:visual.originalityInspection,
    professionalExecutionInspection:visual.professionalExecutionInspection,
    platformPackagingInspection:visual.platformPackagingInspection,
    lyricInspection:{
      status:'PASS',
      notes:'Not applicable to this SHORT package; no synchronized lyric claim is present in the immutable release payload.',
    },
  }
  return evidence
}
function allEvidencePass(evidence){
  return Object.entries(evidence).every(([,v])=>v?.status==='PASS')
}

async function approvalState(entry){
  const url=`${v59Base}/api/content-agents/approval-record?contentHash=${encodeURIComponent(entry.contentHash)}&masterHash=${encodeURIComponent(entry.masterHash)}`
  return fetchJson(url,cronSecret)
}
async function reviseContent(entry,failed){
  const prompt={
    task:'Revise this blocked One Million Souls SHORT package for a brand-new production version. Return JSON only.',
    current:{
      title:entry.releasePayload?.title,
      scriptureReference:entry.releasePayload?.scriptureReference,
      script:entry.releasePayload?.script,
      caption:entry.releasePayload?.caption,
    },
    failedGates:failed,
    requirements:[
      'Create original wording; do not copy protected scripts, captions, titles, melodies, or edits.',
      'Keep Jesus-centred Christian encouragement biblically faithful and factually accurate.',
      'Do not turn narrative/covenant passages into unconditional personal prosperity promises.',
      'Use one clear felt need, a strong first-two-second hook, concise story progression, faithful Scripture context, practical next step, and hopeful close.',
      'Do not manipulate fear, promise guaranteed earthly outcomes, or use engagement bait as theology.',
      'Caption must accurately represent the revised master and may include relevant hashtags.',
      'Return exactly: title, scriptureReference, script, caption.'
    ],
  }
  const r=await openaiClient().responses.create({model:visualModel,input:JSON.stringify(prompt),max_output_tokens:1200})
  const parsed=jsonFromText(r.output_text)
  const replacement={
    title:String(parsed?.title||'').trim().slice(0,120),
    ref:String(parsed?.scriptureReference||parsed?.ref||'').trim().slice(0,120),
    script:String(parsed?.script||'').trim().slice(0,3500),
    caption:String(parsed?.caption||'').trim().slice(0,2200),
  }
  if(!replacement.title||!replacement.ref||replacement.script.length<80||!replacement.caption)throw new Error('CONTENT_REVISION_INCOMPLETE')
  return replacement
}

async function requestProductionRetry(entry,reason,replacement=null){
  try{
    const result=await postJson(`${rendererBase}/factory-retry`,{
      date:entry.targetDate,slot:entry.slot,expectedMasterHash:entry.masterHash,reason,replacement
    },renderSecret)
    console.warn('MASTER_CERTIFICATION_RETURNED_TO_PRODUCTION',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,targetDate:entry.targetDate,slot:entry.slot,retryAttempt:result?.retryAttempt}))
    return result
  }catch(error){
    console.error('MASTER_CERTIFICATION_RETRY_REQUEST_FAILED',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,error:error instanceof Error?error.message:String(error)}))
    return null
  }
}
function contentLevelFailures(failed){
  const contentGates=new Set(['theologyInspection','factualInspection','scriptureContextInspection','metadataInspection','contentQualityInspection','originalityInspection','platformPackagingInspection'])
  return failed.filter((x)=>contentGates.has(x.gate))
}

async function recordQaBlock(entry,stage,details){
  const evidence=`BLOCK - ${stage}: ${typeof details==='string'?details:JSON.stringify(details)}`.slice(0,12000)
  try{
    return await postJson(`${v59Base}/api/content-agents/approval-record`,{
      agentId:'qa',decision:'BLOCK',contentHash:entry.contentHash,masterHash:entry.masterHash,evidence
    },cronSecret)
  }catch(error){
    console.error('MASTER_CERTIFICATION_QA_BLOCK_PERSIST_FAILED',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,error:error instanceof Error?error.message:String(error)}))
    return null
  }
}
function hasPriorTerminalVotes(state){
  const vals=Object.values(state?.approvals||{})
  return vals.some((v)=>['REVISE','BLOCK'].includes(String(v?.decision||'').toUpperCase()))
}
function hasAnyRecordedVotes(state){
  const vals=Object.values(state?.approvals||{})
  return vals.some((v)=>String(v?.decision||'').toUpperCase()!=='PENDING')
}

async function candidateEntries(){
  if(!rendererBase)throw new Error('RENDERER_BASE_URL_MISSING')
  const out=[]
  for(let day=1;day<=advanceDays;day++){
    const date=futureDate(day)
    try{
      const manifest=await fetchJson(`${rendererBase}/factory-manifest?date=${date}`,renderSecret)
      const versionMatch=String(manifest?.pipelineVersion||'').match(/v59-professional-master-certified-v(\d+)$/)
      if(!versionMatch||Number(versionMatch[1])<17){
        console.warn('MASTER_CERTIFICATION_STALE_PIPELINE_SKIP',JSON.stringify({date,pipelineVersion:manifest?.pipelineVersion||'missing'}))
        continue
      }
      for(const entry of manifest?.entries||[]){
        if(entry?.renderQualityGate!=='PASS'||!entry?.professionalMasterCandidate||entry?.releaseStatus!=='AWAITING_MASTER_CERTIFICATION')continue
        if(!validHash(entry?.masterHash)||!validHash(entry?.contentHash)||!validHash(entry?.thumbnailHash))continue
        if(!entry?.releasePayload||entry.releasePayload.masterHash!==entry.masterHash)continue
        if(!entry?.reviewAssets?.audioReviewUrl||!validHash(entry?.reviewAssets?.audioReviewHash))continue
        if(entry?.fullDecodeInspection?.passed!==true)continue
        const scheduled=Date.parse(entry?.scheduledPublishAt||'')
        if(!Number.isFinite(scheduled)||scheduled-Date.now()<2*60*60*1000)continue
        out.push({...entry,targetDate:date})
      }
    }catch(error){
      console.warn('MASTER_CERTIFICATION_MANIFEST_SKIP',JSON.stringify({date,error:error instanceof Error?error.message:String(error)}))
    }
  }
  return out.sort((a,b)=>Date.parse(a.scheduledPublishAt)-Date.parse(b.scheduledPublishAt))
}

export async function runCertificationCycle(){
  if(process.env.MASTER_CERTIFICATION_ENABLED==='false')return {ok:true,skipped:true,reason:'DISABLED'}
  if(!zeroCreditOnly&&!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY_MISSING')
  const candidates=await candidateEntries()
  for(const entry of candidates){
    let state
    try{state=await approvalState(entry)}catch(error){
      console.warn('MASTER_CERTIFICATION_APPROVAL_STATE_FAILED',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,error:error instanceof Error?error.message:String(error)}))
      continue
    }
    if(state?.certificate?.certification==='PROFESSIONAL_MASTER_CERTIFIED'&&state?.certificate?.masterHash===entry.masterHash)continue
    const reviewKey=`${entry.contentHash}:${entry.masterHash}`
    if(Number(reviewBackoffUntil.get(reviewKey)||0)>Date.now()){
      console.warn('MASTER_CERTIFICATION_REVIEW_BACKOFF',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,retryAt:new Date(reviewBackoffUntil.get(reviewKey)).toISOString()}))
      continue
    }
    if(hasPriorTerminalVotes(state)){
      console.warn('MASTER_CERTIFICATION_REQUIRES_NEW_VERSION',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,reason:'EXISTING_REVISE_OR_BLOCK'}))
      continue
    }
    if(hasAnyRecordedVotes(state)){
      console.warn('MASTER_CERTIFICATION_PARTIAL_APPROVALS_RECOVERY',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,reason:'Existing non-terminal approvals will be re-evaluated on the same immutable hash to complete durable certification.'}))
    }

    console.log('MASTER_CERTIFICATION_CANDIDATE',JSON.stringify({targetDate:entry.targetDate,slot:entry.slot,title:entry.title,contentHash:entry.contentHash,masterHash:entry.masterHash}))
    const technical=objectiveTechnical(entry)
    const rights=rightsEvidence(entry)
    const integrity=await verifyIntegrity(entry)
    if([technical.status,rights.status,integrity.status].some((x)=>x!=='PASS')){
      const block={technical:technical.status,rights:rights.status,integrity:integrity.status,technicalNotes:technical.notes,rightsNotes:rights.notes,integrityNotes:integrity.notes}
      console.error('MASTER_CERTIFICATION_OBJECTIVE_BLOCK',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,...block}))
      await recordQaBlock(entry,'OBJECTIVE_PREFLIGHT',block)
      if(technical.status!=='PASS'||integrity.status!=='PASS')await requestProductionRetry(entry,`OBJECTIVE_PREFLIGHT: ${JSON.stringify(block)}`)
      return {ok:false,blocked:true,stage:'OBJECTIVE_PREFLIGHT',contentHash:entry.contentHash,masterHash:entry.masterHash}
    }

    let visual,audio
    try{
      if(zeroCreditOnly){
        const zero=await zeroCreditPreflight(entry,{technical,rights,integrity})
        visual=zero.visual
        audio=zero.audio
        console.log('MASTER_CERTIFICATION_ZERO_CREDIT_PREFLIGHT',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,summary:zero.summary,ledgerVersion:zero.curated?.ledgerVersion}))
      }else{
        ;[visual,audio]=await Promise.all([
          visualReview(entry,technical,rights),
          audioReview(entry,integrity.audioBytes),
        ])
      }
    }catch(error){
      const message=error instanceof Error?error.message:String(error)
      console.error('MASTER_CERTIFICATION_REVIEW_EXECUTION_BLOCK',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,error:message}))
      reviewBackoffUntil.set(reviewKey,Date.now()+30*60*1000)
      return {ok:false,blocked:true,transient:true,stage:'MULTIMODAL_REVIEW',contentHash:entry.contentHash,masterHash:entry.masterHash,error:message}
    }
    const evidence=aggregateEvidence(entry,technical,rights,integrity,visual,audio)
    if(!allEvidencePass(evidence)){
      const failed=Object.entries(evidence).filter(([,v])=>v?.status!=='PASS').map(([k,v])=>({gate:k,status:v?.status,notes:v?.notes}))
      console.error('MASTER_CERTIFICATION_CREATIVE_BLOCK',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,failed}))
      await recordQaBlock(entry,'PROFESSIONAL_MASTER_PREFLIGHT',failed)
      const contentFailures=contentLevelFailures(failed)
      if(!contentFailures.length){
        await requestProductionRetry(entry,`PROFESSIONAL_MASTER_PREFLIGHT: ${JSON.stringify(failed)}`)
      }else{
        console.error('MASTER_CERTIFICATION_CONTENT_REVISION_REQUIRED',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,failed:contentFailures}))
        try{
          if(zeroCreditOnly)throw new Error('ZERO_CREDIT_CONTENT_REVISION_REQUIRES_NEW_CURATED_LEDGER_ENTRY')
          const replacement=await reviseContent(entry,contentFailures)
          await requestProductionRetry(entry,`CONTENT_REVISION_REQUIRED: ${JSON.stringify(contentFailures)}`,replacement)
          console.warn('MASTER_CERTIFICATION_CONTENT_REVISION_QUEUED',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,targetDate:entry.targetDate,slot:entry.slot,newTitle:replacement.title,newScriptureReference:replacement.ref}))
        }catch(error){
          console.error('MASTER_CERTIFICATION_CONTENT_REVISION_FAILED',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,error:error instanceof Error?error.message:String(error)}))
        }
      }
      return {ok:false,blocked:true,stage:'PROFESSIONAL_MASTER_PREFLIGHT',contentRevisionRequired:contentFailures.length>0,contentHash:entry.contentHash,masterHash:entry.masterHash,evidence}
    }

    const master={
      releasePayload:entry.releasePayload,
      mediaUrl:entry.mediaUrl,
      thumbnailUrl:entry.thumbnailUrl,
      reviewAssets:entry.reviewAssets,
      renderer:entry.renderer,
      scheduledPublishAt:entry.scheduledPublishAt,
    }
    const execution=await postJson(`${v59Base}/api/content-agents/approval-execute`,{
      contentHash:entry.contentHash,
      masterHash:entry.masterHash,
      master,
      evidence,
    },cronSecret)
    console.log('MASTER_CERTIFICATION_49_AGENT_RESULT',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,all49Approved:execution?.all49Approved===true,reviewEngine:execution?.reviewEngine||null}))
    console.log('MASTER_CERTIFICATION_EXECUTED',JSON.stringify({
      contentHash:entry.contentHash,masterHash:entry.masterHash,
      certification:execution?.certification,releaseStatus:execution?.releaseStatus,recorded:execution?.recorded
    }))
    if(execution?.certification!=='PROFESSIONAL_MASTER_CERTIFIED'){
      const failedVotes=Object.entries(execution?.decisions||{})
        .filter(([agentId,v])=>agentId!=='publisher'&&v?.decision!=='APPROVE')
        .map(([agentId,v])=>({agentId,decision:v?.decision,evidence:String(v?.evidence||'').slice(0,2000)}))
      if(failedVotes.length){
        const contentAgents=new Set([
          'theology-guard','script-writer','content-director','metadata-strategist','platform-packaging-producer',
          'scripture-context-auditor','factual-verification-auditor','devotional-punchup-editor','story-arc-writer',
          'concept-architect','channel-strategist','hook-lab'
        ])
        const needsContentRevision=failedVotes.some((x)=>contentAgents.has(x.agentId))
        if(needsContentRevision){
          try{
            if(zeroCreditOnly)throw new Error('ZERO_CREDIT_CONTENT_REVISION_REQUIRES_NEW_CURATED_LEDGER_ENTRY')
            const replacement=await reviseContent(entry,failedVotes)
            await requestProductionRetry(entry,`AGENT_RELEASE_REVIEW_CONTENT_REVISION: ${JSON.stringify(failedVotes)}`,replacement)
            console.warn('MASTER_CERTIFICATION_AGENT_REVISION_QUEUED',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,newTitle:replacement.title,failedAgents:failedVotes.map((x)=>x.agentId)}))
          }catch(error){
            console.error('MASTER_CERTIFICATION_AGENT_REVISION_FAILED',JSON.stringify({contentHash:entry.contentHash,masterHash:entry.masterHash,error:error instanceof Error?error.message:String(error),failedAgents:failedVotes.map((x)=>x.agentId)}))
          }
        }else{
          await requestProductionRetry(entry,`AGENT_RELEASE_REVIEW_MEDIA_REVISION: ${JSON.stringify(failedVotes)}`)
        }
      }
    }
    return {ok:execution?.certification==='PROFESSIONAL_MASTER_CERTIFIED',entry:{targetDate:entry.targetDate,slot:entry.slot,title:entry.title,contentHash:entry.contentHash,masterHash:entry.masterHash},execution}
  }
  const readiness=await releaseReadinessSummary().catch((error)=>({days:advanceDays,expected:advanceDays*3,total:0,certified:0,awaiting:0,deadlineMissed:0,productionRetry:0,invalid:1,allCertified:false,issues:[{reason:'READINESS_SUMMARY_FAILED',error:error instanceof Error?error.message:String(error)}]}))
  console.log('RELEASE_BUFFER_READINESS',JSON.stringify({...readiness,nextDayPackages:undefined}))
  if(Array.isArray(readiness.nextDayPackages)&&readiness.nextDayPackages.length){
    console.log('RELEASE_NEXT_DAY_PACKAGES',JSON.stringify({targetDate:readiness.nextDayPackages[0]?.targetDate||null,count:readiness.nextDayPackages.length,packages:readiness.nextDayPackages}))
  }
  return {ok:readiness.allCertified,skipped:true,reason:readiness.allCertified?'ALL_BUFFER_MASTERS_CERTIFIED':'NO_PENDING_CERTIFIABLE_MASTER',readiness}
}
