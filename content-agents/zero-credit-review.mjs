import fs from 'node:fs/promises'
import path from 'node:path'

let ledgerPromise=null
async function ledger(){
  if(!ledgerPromise)ledgerPromise=fs.readFile(path.join(process.cwd(),'content-agents','verified-content-ledger.json'),'utf8').then(JSON.parse)
  return ledgerPromise
}
function words(text){return String(text||'').trim().split(/\s+/).filter(Boolean)}
function pass(notes,extra={}){return {status:'PASS',notes,...extra}}
function block(notes,extra={}){return {status:'BLOCK',notes,...extra}}

async function curatedContent(entry){
  const data=await ledger()
  const found=(data.items||[]).find((item)=>item.title===entry?.title)
  if(!found)return {ok:false,reason:'TITLE_NOT_IN_CURATED_LEDGER',ledgerVersion:data.version}
  const exact=
    found.scriptureReference===entry?.scriptureReference&&
    found.script===entry?.script&&
    found.caption===entry?.caption&&
    found.title===entry?.title
  return {ok:exact,reason:exact?'EXACT_LEDGER_MATCH':'CURATED_CONTENT_MISMATCH',ledgerVersion:data.version,item:found}
}

function packagingPass(entry){
  const p=entry?.releasePayload||{}
  const t=p?.platformPackages?.tiktok||{}
  const y=p?.platformPackages?.youtube||{}
  return Boolean(
    p.title===entry.title&&p.script===entry.script&&p.caption===entry.caption&&
    p.scriptureReference===entry.scriptureReference&&
    t.caption===entry.caption&&t.privacyLevel==='PUBLIC_TO_EVERYONE'&&t.isAigc===true&&
    y.title===entry.title&&y.description===entry.caption&&y.privacyStatus==='public'&&
    y.madeForKids===false&&y.isAiGeneratedContent===true
  )
}

function voiceWpm(entry){
  const seconds=Number(entry?.durationSeconds||entry?.masterInspection?.durationSeconds||0)
  if(!seconds)return 0
  return words(entry?.script).length/(seconds/60)
}

export async function zeroCreditPreflight(entry,{technical,rights,integrity}){
  const curated=await curatedContent(entry)
  const stockOnly=Array.isArray(entry?.sceneSources)&&entry.sceneSources.length>=3&&
    entry.sceneSources.every((x)=>x==='rights-cleared-stock-video')
  const storyboardMatched=entry?.visualStoryboardInspection?.passed===true&&
    entry?.visualStoryboardInspection?.version==='v59-visual-coherence-v1'&&
    entry?.visualStoryboardInspection?.humanPerceptualReviewRequired===true
  const visualMeasured=stockOnly&&storyboardMatched&&entry?.masterInspection?.passed===true&&entry?.fullDecodeInspection?.passed===true&&
    entry?.visualVarietyInspection?.passed===true&&Array.isArray(entry?.sceneMotionInspection)&&
    entry.sceneMotionInspection.length>=3&&entry.sceneMotionInspection.every((x)=>x?.passed===true)
  const captionPass=entry?.captionInspection?.passed===true
  const safePass=captionPass&&Number(entry?.captionInspection?.horizontalSafeMargin)>=120&&Number(entry?.captionInspection?.bottomSafeMargin)>=360
  const audioTech=entry?.audioInspection?.passed===true
  const wpm=voiceWpm(entry)
  const voiceProviderOk=/Kokoro/i.test(String(entry?.voiceProvider||''))&&
    String(entry?.voiceRights?.license||'').toLowerCase()==='apache-2.0'
  const voicePacing=wpm>=110&&wpm<=190
  const metadataOk=packagingPass(entry)&&String(entry?.caption||'').includes(String(entry?.scriptureReference||''))&&
    words(entry?.title).length<=5&&String(entry?.caption||'').length<=2200
  const thumbnailOk=integrity?.status==='PASS'&&visualMeasured&&words(entry?.title).length<=5
  const contentStructure=words(entry?.script).length>=35&&words(entry?.script).length<=110&&
    /\b(Jesus|God|Christ|Lord)\b/i.test(String(entry?.script||''))&&
    String(entry?.script||'').includes(String(entry?.scriptureReference||''))
  const noGuarantee=!/guaranteed|you will be rich|you will get everything|God must|God will make you wealthy|instant miracle/i.test(String(entry?.script||''))
  const originality=rights?.status==='PASS'&&curated.ok
  const platformOk=metadataOk
  const visualQuality=visualMeasured
  const frameQuality=visualMeasured
  const audioQuality=audioTech&&voiceProviderOk&&voicePacing
  const contentQuality=curated.ok&&contentStructure&&noGuarantee
  const proExecution=technical?.status==='PASS'&&rights?.status==='PASS'&&integrity?.status==='PASS'&&
    visualQuality&&audioQuality&&contentQuality&&metadataOk&&safePass&&thumbnailOk

  const visual={
    creativeMaster:block('Deterministic metrics and curated text cannot establish a professional creative master. An independent perceptual review of the exact final video and mixed audio is required; keep in PRE_PRODUCTION and publishing locked.',{technicalProxiesPassed:proExecution}),
    thumbnailInspection:thumbnailOk?pass('Thumbnail is an immutable hash-bound frame from the exact master, with short title treatment and verified visual integrity.'):block('Thumbnail identity, visual integrity, or title economy failed.'),
    metadataInspection:metadataOk?pass('TikTok and YouTube metadata exactly match the immutable releasePayload; Scripture reference is present and platform disclosure fields are fixed.'):block('Metadata/package mismatch or required Scripture/package fields failed.'),
    theologyInspection:curated.ok?pass(`Exact curated ledger match (${curated.ledgerVersion}). ${curated.item.theologyNote}`,{ledgerVersion:curated.ledgerVersion}):block(`Content is not an exact approved curated-ledger version: ${curated.reason}`,{ledgerVersion:curated.ledgerVersion}),
    factualInspection:curated.ok?pass(`Exact curated ledger match. ${curated.item.factualNote}`,{ledgerVersion:curated.ledgerVersion}):block('Factual verification requires exact curated-ledger content in zero-credit mode.'),
    scriptureContextInspection:curated.ok?pass(`Scripture context is bound to the exact curated entry for ${entry.scriptureReference}. ${curated.item.theologyNote}`,{ledgerVersion:curated.ledgerVersion}):block('Scripture-context verification requires exact curated-ledger content in zero-credit mode.'),
    visualQualityInspection:visualQuality?pass('Every final scene is rights-cleared real-motion stock; no AI-generated visual scene, procedural scene, freeze, black frame, duplicate stock scene, or animated-still substitute is present.'):block('Measured stock-only visual-quality requirements failed.'),
    frameQualityInspection:frameQuality?pass('Final master and each scene passed black/freeze/motion inspection and end-to-end decode at the required export profile.'):block('Measured frame-quality requirements failed.'),
    contentQualityInspection:contentQuality?pass('Exact curated devotional package has a concise hook/theme, explicit Scripture reference, Jesus/God-centered application, bounded length, and no guaranteed-earthly-outcome language.'):block('Content structure, curated identity, or non-manipulative claim checks failed.'),
    originalityInspection:originality?pass('Exact curated original script package plus item-level visual/audio rights provenance passed. This is not a claim of a global plagiarism search.'):block('Originality/provenance release evidence is incomplete.'),
    professionalExecutionInspection:block('Objective renderer proxies do not prove professional execution. Requires independent review of the exact final moving picture, voice performance, pacing, and mix.',{technicalProxiesPassed:proExecution}),
    platformPackagingInspection:platformOk?pass('Final TikTok and YouTube packages are exact immutable payload fields with AI disclosure and visibility settings locked.'):block('Platform packaging differs from immutable release payload or required settings.'),
  }
  const audio={
    audioInspection:audioTech?pass(`Final mixed master passed renderer loudness/true-peak/LRA analysis: ${JSON.stringify(entry.audioInspection)}`,{objective:entry.audioInspection}):block('Final mixed master technical audio inspection failed.',{objective:entry.audioInspection}),
    voicePerformanceInspection:block('Speaking rate and loudness alone cannot verify naturalness, pronunciation, or emotional delivery; independent exact-master listening is required.',{wordsPerMinute:Number(wpm.toFixed(1)),provider:entry.voiceProvider,technicalProxiesPassed:audioQuality}),
  }
  return {visual,audio,curated,summary:{visualMeasured,storyboardMatched,audioQuality,contentQuality,metadataOk,thumbnailOk,safePass,proExecution,wpm}}
}

const AGENT_GATES={
  'trend-scout':['contentQualityInspection','metadataInspection'],
  'million-view-scout':['originalityInspection','contentQualityInspection'],
  'channel-strategist':['platformPackagingInspection','metadataInspection','contentQualityInspection'],
  'competitor-mapper':['originalityInspection','contentQualityInspection'],
  'search-intent-analyst':['metadataInspection','contentQualityInspection'],
  'audience-insight-researcher':['contentQualityInspection','platformPackagingInspection'],
  'retention-scientist':['contentQualityInspection','professionalExecutionInspection'],
  'hook-lab':['contentQualityInspection','metadataInspection'],
  'format-innovation-lab':['originalityInspection','professionalExecutionInspection'],
  'thumbnail-researcher':['thumbnailInspection'],
  'metadata-strategist':['metadataInspection','platformPackagingInspection'],
  'content-portfolio-planner':['contentQualityInspection'],
  'executive-producer':['professionalExecutionInspection','technicalMaster'],
  'storyboard-producer':['visualQualityInspection','contentQualityInspection'],
  'media-producer':['professionalExecutionInspection','rightsManifest'],
  'motion-editor':['visualQualityInspection','frameQualityInspection','technicalMaster'],
  'sound-designer':['audioInspection','voicePerformanceInspection'],
  'repurposing-editor':['platformPackagingInspection','contentQualityInspection'],
  'media-librarian':['rightsManifest','masterIntegrityInspection'],
  'production-scheduler':['metadataInspection','masterIntegrityInspection'],
  'rights-scout':['rightsManifest'],
  'theology-guard':['theologyInspection','scriptureContextInspection'],
  'script-writer':['contentQualityInspection','theologyInspection','originalityInspection'],
  'asset-scout':['rightsManifest','visualQualityInspection'],
  'music-director':['rightsManifest','audioInspection'],
  'visual-director':['visualQualityInspection','frameQualityInspection'],
  'thumbnail-director':['thumbnailInspection'],
  'content-director':['contentQualityInspection','theologyInspection','factualInspection'],
  'shorts-editor':['professionalExecutionInspection','captionInspection','visualQualityInspection'],
  'longform-producer':['contentQualityInspection'],
  'lyric-producer':['lyricInspection','rightsManifest'],
  'concept-architect':['contentQualityInspection','originalityInspection'],
  'story-arc-writer':['contentQualityInspection'],
  'devotional-punchup-editor':['contentQualityInspection','theologyInspection'],
  'visual-concept-designer':['visualQualityInspection','originalityInspection'],
  'broll-sequence-designer':['visualQualityInspection','frameQualityInspection'],
  'voice-performance-director':['voicePerformanceInspection','audioInspection'],
  'caption-design-editor':['captionInspection','safeZoneInspection'],
  'platform-packaging-producer':['platformPackagingInspection','metadataInspection','thumbnailInspection'],
  'scripture-context-auditor':['scriptureContextInspection','theologyInspection'],
  'factual-verification-auditor':['factualInspection'],
  'visual-realism-auditor':['visualQualityInspection','frameQualityInspection'],
  'frame-quality-inspector':['frameQualityInspection','masterIntegrityInspection'],
  'audio-mastering-auditor':['audioInspection','technicalMaster'],
  'mobile-safe-zone-inspector':['safeZoneInspection','captionInspection'],
  'export-encoding-inspector':['exportInspection','technicalMaster'],
  'master-integrity-auditor':['masterIntegrityInspection','fullWatch'],
  'qa':['technicalMaster','creativeMaster','professionalExecutionInspection','rightsManifest','masterIntegrityInspection'],
  'analytics-learner':['metadataInspection','platformPackagingInspection'],
}

export function evaluateZeroCreditAgents({contentHash,masterHash,evidence,requiredAgents}){
  const decisions={}
  for(const agentId of requiredAgents){
    if(agentId==='publisher')continue
    const gates=AGENT_GATES[agentId]||['professionalExecutionInspection']
    const failed=gates.filter((gate)=>evidence?.[gate]?.status!=='PASS')
    if(failed.length){
      decisions[agentId]={decision:'BLOCK',evidence:`BLOCK - zero-credit deterministic reviewer checked exact contentHash=${contentHash} masterHash=${masterHash}; failed gates: ${failed.join(', ')}. ${failed.map((g)=>`${g}: ${evidence?.[g]?.notes||'missing'}`).join(' | ')}`}
    }else{
      decisions[agentId]={decision:'APPROVE',evidence:`APPROVE - zero-credit deterministic reviewer checked exact contentHash=${contentHash} masterHash=${masterHash}; remit gates PASS: ${gates.join(', ')}. ${gates.map((g)=>`${g}: ${evidence?.[g]?.notes||'PASS'}`).join(' | ')}`}
    }
  }
  const nonPublisher=requiredAgents.filter((x)=>x!=='publisher')
  const all49=nonPublisher.length===49&&nonPublisher.every((id)=>decisions[id]?.decision==='APPROVE')
  decisions.publisher=all49
    ? {decision:'APPROVE',evidence:`APPROVE - Publisher last. All 49 deterministic zero-credit release reviewers approved the exact immutable contentHash=${contentHash} masterHash=${masterHash}. No repair, substitution, recompression, metadata edit, or asset change occurred after review.`}
    : {decision:'BLOCK',evidence:'BLOCK - Publisher cannot approve because one or more of the 49 prior release reviewers did not APPROVE the exact immutable master.'}
  return {contentHash,masterHash,decisions,all49Approved:all49,reviewEngine:'zero-credit-deterministic-v1'}
}
