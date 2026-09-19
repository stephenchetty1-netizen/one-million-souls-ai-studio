import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'node:crypto'
import { planVisualStory } from './visual-storyboard.mjs'

const PORT = Number(process.env.PORT || 3000)
const TIMEZONE = process.env.APP_TIMEZONE || 'Africa/Johannesburg'
const SECRET = process.env.VIDEO_RENDER_SECRET || ''
const enabled = process.env.DAILY_FACTORY_ENABLED !== 'false'
const storageReady = Boolean(process.env.ENDPOINT && process.env.BUCKET && process.env.REGION && process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY)
const PIPELINE_VERSION = 'v59-professional-master-certified-v18'
const RELEASE_READY_BUFFER_MS = 2 * 60 * 60 * 1000
const ADVANCE_DAYS = Math.max(2, Number(process.env.CONTENT_BUFFER_DAYS || 7))
const configuredQuotaPause = Number(process.env.FREE_ZEROGPU_QUOTA_COOLDOWN_MS || 60 * 60 * 1000)
const QUOTA_COOLDOWN_MS = Number.isFinite(configuredQuotaPause)
  ? Math.max(15 * 60 * 1000, Math.min(6 * 60 * 60 * 1000, configuredQuotaPause))
  : 60 * 60 * 1000
let zeroGpuCooldownUntil = 0
const QUOTA_COOLDOWN_KEY = 'factory/zerogpu-quota-cooldown.json'

const s3 = storageReady ? new S3Client({
  endpoint: process.env.ENDPOINT,
  region: process.env.REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.ACCESS_KEY_ID, secretAccessKey: process.env.SECRET_ACCESS_KEY },
}) : null

const BANK = [
  { title:'GOD IS NEAR', ref:'Psalm 34:18', script:'When your heart feels heavy, do not mistake pain for abandonment. Psalm 34:18 points us to a God who comes near to the brokenhearted. Bring the hurt to Jesus instead of hiding it. Pray honestly, stay close to Scripture, and take the next faithful step. You are not walking through this moment unseen.', caption:'When your heart feels heavy, remember: God is near. Keep bringing it to Jesus. Psalm 34:18. #Jesus #Faith #Prayer #ChristianEncouragement #OneMillionSouls' },
  { title:'FAITH OVER FEAR', ref:'Isaiah 41:10', script:'Fear can be loud, but it does not get the final word. Isaiah 41:10 reminds God’s people not to fear because He is with them and will strengthen them. You may not control every outcome, but you can choose where you place your trust. Fix your heart on Jesus and take today one step at a time.', caption:'Fear may be loud, but God is with you. Isaiah 41:10. Choose faith today. #FaithOverFear #Jesus #ChristianTikTok #Hope #OneMillionSouls' },
  { title:'DO NOT CARRY TOMORROW', ref:'Matthew 6:34', script:'You were never asked to carry tomorrow before it arrives. In Matthew 6:34, Jesus teaches us not to be consumed by tomorrow’s worries. Give today your faithful attention. Pray about what you cannot control, do what is right in front of you, and trust God with what comes next.', caption:'You do not have to carry tomorrow today. Matthew 6:34. Trust Jesus with the next step. #Jesus #TrustGod #Prayer #Faith #OneMillionSouls' },
  { title:'GRACE IN WEAKNESS', ref:'2 Corinthians 12:9', script:'Your weakness does not disqualify you from God’s work. In 2 Corinthians 12:9, Paul points to Christ’s grace as sufficient and His power as made perfect in weakness. Stop pretending you must be strong every second. Depend on Jesus, ask for help, and let grace meet you where your strength ends.', caption:'Your weakness is not the end of your story. Christ’s grace is sufficient. 2 Corinthians 12:9. #Grace #Jesus #Faith #ChristianEncouragement #OneMillionSouls' },
  { title:'KEEP PRAYING', ref:'Luke 18:1', script:'Do not let delay convince you that prayer is pointless. Luke 18:1 introduces Jesus teaching His disciples to pray and not give up. Prayer is not about forcing God to follow our timetable. It is about continuing to trust Him, bringing our needs honestly, and staying faithful while we wait.', caption:'Do not give up on prayer. Keep trusting Jesus while you wait. Luke 18:1. #Prayer #Jesus #Faith #KeepPraying #OneMillionSouls' },
  { title:'GOD IS STILL WORKING', ref:'Romans 8:28', script:'A difficult chapter does not mean God has stopped working. Romans 8:28 gives believers confidence that God works in all things for the good of those who love Him and are called according to His purpose. We may not understand every moment now, but we can keep trusting Jesus through it.', caption:'A hard chapter does not mean God has stopped working. Romans 8:28. Keep trusting Jesus. #Jesus #Faith #Hope #TrustGod #OneMillionSouls' },
  { title:'YOU ARE NOT ALONE', ref:'Hebrews 13:5', script:'Loneliness can make you feel forgotten, but feelings are not the whole story. Hebrews 13:5 reminds believers of God’s promise never to leave or forsake them. Reach out to trusted people, stay connected to Christian community, and remember that Jesus remains faithful even in quiet seasons.', caption:'You are not forgotten. Stay connected, keep praying, and remember God’s faithfulness. Hebrews 13:5. #Jesus #Hope #Faith #ChristianCommunity #OneMillionSouls' },
  { title:'BE STILL', ref:'Psalm 46:10', script:'Not every battle is won by doing more. Psalm 46:10 calls us to be still and know that God is God. Make space today to stop the noise, pray, listen, and remember who is truly in control. Stillness is not giving up. It is choosing to trust God instead of letting panic lead you.', caption:'Be still. Pray. Remember who God is. Psalm 46:10. #BeStill #Jesus #Prayer #Faith #OneMillionSouls' },
  { title:'LET YOUR LIGHT SHINE', ref:'Matthew 5:16', script:'Your faith was never meant to stay hidden. In Matthew 5:16, Jesus calls His followers to let their light shine so that others may see good works and glorify the Father. Live your faith with humility, kindness, courage, and truth today. Point people to Jesus through both words and actions.', caption:'Let your light shine today—not for attention, but to point people to God. Matthew 5:16. #LetYourLightShine #Jesus #Faith #ChristianLife #OneMillionSouls' },
  { title:'NOTHING CAN SEPARATE YOU', ref:'Romans 8:38-39', script:'Your circumstances can change quickly, but the love of God in Christ is not fragile. Romans 8:38-39 reminds believers that nothing in creation can separate them from God’s love in Christ Jesus. Hold onto that truth when emotions shift. Jesus remains faithful.', caption:'Circumstances change. God’s love in Christ remains. Romans 8:38-39. #Jesus #GodsLove #Faith #Hope #OneMillionSouls' },
  { title:'START AGAIN WITH GOD', ref:'Lamentations 3:22-23', script:'Yesterday does not have to control today. Lamentations 3:22-23 celebrates God’s steadfast love, mercy, and faithfulness. Confess what needs to change, receive God’s mercy, and begin again with Jesus. A fresh start is not pretending the past never happened; it is choosing faithfulness from here.', caption:'God’s mercy gives room to begin again. Lamentations 3:22-23. #NewMercies #Jesus #Faith #Grace #OneMillionSouls' },
  { title:'RUN YOUR RACE', ref:'Hebrews 12:1-2', script:'Stop measuring your calling against someone else’s highlight reel. Hebrews 12:1-2 tells believers to run with endurance while fixing their eyes on Jesus. Lay aside what keeps pulling you away from Him. Stay faithful to the race God has placed before you, one obedient step at a time.', caption:'Run your race with your eyes on Jesus. Hebrews 12:1-2. #Jesus #Faith #Purpose #Endurance #OneMillionSouls' }
]

function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date)
  const m = Object.fromEntries(parts.map(p=>[p.type,p.value]))
  return { date:`${m.year}-${m.month}-${m.day}`, time:`${m.hour}:${m.minute}` }
}

function futureDate(days=1) { return localDate(new Date(Date.now()+days*24*60*60*1000)).date }
function tomorrowDate() { return futureDate(1) }
function hashDate(s) { return [...s].reduce((a,c)=>((a*31+c.charCodeAt(0))>>>0),7) }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonicalize(value[key])]))
  return value
}
function manifestKey(date) { return `manifests/${date}.json` }
function buildingManifestKey(date) { return `manifests/${date}.building.json` }

async function readJsonObject(key) {
  if (!s3) return null
  try {
    const result = await s3.send(new GetObjectCommand({Bucket:process.env.BUCKET,Key:key}))
    const text = await result.Body?.transformToString()
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function configuredSlots() {
  const slots = (process.env.PUBLISH_SLOTS || '08:00,15:30,20:30').split(',').map(s=>s.trim()).filter(Boolean)
  if (slots.length !== 3 || slots.some(slot => !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot))) {
    throw new Error('PUBLISH_SLOTS must contain exactly 3 valid HH:MM slots')
  }
  return slots
}

function slotTimestamp(date, slot) {
  const [hour, minute] = slot.split(':').map(Number)
  // Africa/Johannesburg is UTC+02:00 year-round.
  return Date.parse(`${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00+02:00`)
}

function manifestIsCurrent(manifest, date, slots) {
  if (!manifest || manifest.targetDate !== date || manifest.pipelineVersion !== PIPELINE_VERSION) return false
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== slots.length) return false
  return manifest.entries.every((entry, index) =>
    entry?.slot === slots[index] &&
    entry?.renderer === 'one-million-souls-zero-credit-v3' &&
    entry?.renderQualityGate === 'PASS' &&
    entry?.professionalMasterCandidate === true &&
    typeof entry?.thumbnailUrl === 'string' && entry.thumbnailUrl.startsWith('http') &&
    /^[a-f0-9]{64}$/i.test(String(entry?.thumbnailHash || '')) &&
    entry?.reviewAssets?.contactSheetUrl &&
    entry?.reviewAssets?.firstFrameUrl &&
    entry?.reviewAssets?.lastFrameUrl &&
    entry?.reviewAssets?.audioReviewUrl &&
    /^[a-f0-9]{64}$/i.test(String(entry?.reviewAssets?.audioReviewHash || '')) &&
    entry?.masterInspection?.passed === true &&
    entry?.fullDecodeInspection?.passed === true &&
    entry?.audioInspection?.passed === true &&
    entry?.captionInspection?.passed === true &&
    entry?.visualVarietyInspection?.passed === true &&
    entry?.visualStoryboardInspection?.passed === true &&
    entry?.visualStoryboardInspection?.version === 'v59-visual-coherence-v1' &&
    entry?.captionInspection?.bottomSafeMargin >= 650 &&
    entry?.captionInspection?.horizontalSafeMargin >= 120 &&
    Array.isArray(entry?.sceneMotionInspection) && entry.sceneMotionInspection.length >= 3 && entry.sceneMotionInspection.every(x => x?.passed === true) &&
    typeof entry?.masterHash === 'string' &&
    entry.masterHash.length === 64 &&
    entry?.publishingLocked === true &&
    entry?.releaseStatus === 'AWAITING_MASTER_CERTIFICATION' &&
    Number.isFinite(Date.parse(entry?.scheduledPublishAt || '')) &&
    Date.parse(entry.scheduledPublishAt) === slotTimestamp(date, slots[index])
  )
}

async function render(item, variationSeed=0) {
  const headers = {'content-type':'application/json'}
  if (SECRET) headers.authorization = `Bearer ${SECRET}`
  const timeoutMs = Math.max(120000, Number(process.env.DAILY_FACTORY_RENDER_TIMEOUT_MS || 600000))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('render watchdog timeout')), timeoutMs)
  console.log('DAILY_FACTORY_RENDER_START', JSON.stringify({title:item.title,timeoutMs,variationSeed}))
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/render-v2`, {
      method:'POST',headers,body:JSON.stringify({title:item.title,script:item.script,scriptureReference:item.ref,variationSeed}),signal:controller.signal
    })
    const data = await r.json().catch(()=>({}))
    if (!r.ok || !data?.ok || !data?.mediaUrl) throw new Error(data?.error || `render failed ${r.status}`)
    if (data?.qualityGate !== 'passed' || data?.publishingAllowed !== false || !data?.masterHash) {
      throw new Error('render-v2 did not return a fail-closed quality-gated master')
    }
    console.log('DAILY_FACTORY_RENDER_PASS', JSON.stringify({title:item.title,masterHash:data.masterHash}))
    return data
  } catch (error) {
    const timedOut = controller.signal.aborted
    console.error(timedOut ? 'DAILY_FACTORY_RENDER_TIMEOUT' : 'DAILY_FACTORY_RENDER_FAIL', JSON.stringify({
      title:item.title,timeoutMs,error:error instanceof Error ? error.message : String(error)
    }))
    throw new Error(timedOut ? `render-v2 timed out after ${timeoutMs}ms` : (error instanceof Error ? error.message : String(error)))
  } finally {
    clearTimeout(timer)
  }
}

export async function generateFor(date) {
  if (!enabled || !s3) return false
  // The cooldown must survive restarts and redeploys: the shared bucket is authoritative.
  // A storage read failure must not be interpreted as permission to burn more free quota.
  const savedCooldown = await readQuotaCooldown()
  zeroGpuCooldownUntil = Math.max(zeroGpuCooldownUntil, savedCooldown)
  if (Date.now() < zeroGpuCooldownUntil) {
    // Do not block manifest reconciliation, existing-master reuse, or explicitly
    // curated quota-free scenes. Individual non-curated renders still fail closed.
    console.warn('DAILY_FACTORY_ZEROGPU_QUOTA_COOLDOWN', JSON.stringify({
      targetDate:date,retryAt:new Date(zeroGpuCooldownUntil).toISOString(),
      curatedStockMayProceed:process.env.CURATED_STOCK_QUOTA_BYPASS === 'true',
      publishingLocked:true
    }))
  }
  const key = manifestKey(date)
  const buildingKey = buildingManifestKey(date)
  const slotTimes = configuredSlots()
  const existing = await readJsonObject(key)
  if (manifestIsCurrent(existing, date, slotTimes)) {
    console.log('DAILY_FACTORY_CURRENT', JSON.stringify({ targetDate: date, pipelineVersion: PIPELINE_VERSION }))
    return true
  }
  if (existing) {
    console.warn('DAILY_FACTORY_STALE_REGENERATE', JSON.stringify({
      targetDate: date,
      oldPipelineVersion: existing.pipelineVersion || 'legacy',
      oldSlots: Array.isArray(existing.entries) ? existing.entries.map(e=>e?.slot) : [],
      newPipelineVersion: PIPELINE_VERSION,
      newSlots: slotTimes,
    }))
  }
  const seed = hashDate(date)
  const previousBuilding = await readJsonObject(buildingKey)
  const reusableEntries = (
    previousBuilding?.pipelineVersion === PIPELINE_VERSION &&
    previousBuilding?.targetDate === date &&
    Array.isArray(previousBuilding?.entries)
  ) ? previousBuilding.entries : []
  const entries = []

  for (let i=0;i<3;i++) {
    const item = BANK[(seed + i*5) % BANK.length]
    const priorRetry = reusableEntries.find((entry) =>
      entry?.slot === slotTimes[i] && entry?.releaseStatus === 'PRODUCTION_RETRY'
    )
    const replacement = priorRetry?.replacement && typeof priorRetry.replacement === 'object' ? priorRetry.replacement : null
    const effectiveItem = replacement ? {
      title:String(replacement.title || item.title).slice(0,120),
      ref:String(replacement.ref || item.ref).slice(0,120),
      script:String(replacement.script || item.script).slice(0,3500),
      caption:String(replacement.caption || item.caption).slice(0,2200),
    } : item
    const reusable = reusableEntries.find((entry) =>
      entry?.slot === slotTimes[i] &&
      entry?.title === effectiveItem.title &&
      entry?.renderQualityGate === 'PASS' &&
      entry?.professionalMasterCandidate === true &&
      typeof entry?.thumbnailUrl === 'string' && entry.thumbnailUrl.startsWith('http') &&
      /^[a-f0-9]{64}$/i.test(String(entry?.thumbnailHash || '')) &&
      entry?.reviewAssets?.contactSheetUrl &&
      entry?.reviewAssets?.firstFrameUrl &&
      entry?.reviewAssets?.lastFrameUrl &&
      entry?.reviewAssets?.audioReviewUrl &&
      /^[a-f0-9]{64}$/i.test(String(entry?.reviewAssets?.audioReviewHash || '')) &&
      entry?.masterInspection?.passed === true &&
      entry?.fullDecodeInspection?.passed === true &&
      entry?.audioInspection?.passed === true &&
      entry?.captionInspection?.passed === true &&
      entry?.visualVarietyInspection?.passed === true &&
      entry?.visualStoryboardInspection?.passed === true &&
      entry?.visualStoryboardInspection?.version === 'v59-visual-coherence-v1' &&
      entry?.captionInspection?.bottomSafeMargin >= 650 &&
      entry?.captionInspection?.horizontalSafeMargin >= 120 &&
      Array.isArray(entry?.sceneMotionInspection) && entry.sceneMotionInspection.length >= 3 && entry.sceneMotionInspection.every(x => x?.passed === true) &&
      typeof entry?.masterHash === 'string' &&
      entry.masterHash.length === 64 &&
      entry?.mediaUrl
    )

    if (reusable) {
      entries.push(reusable)
      console.log('DAILY_FACTORY_REUSE_PARTIAL', JSON.stringify({
        targetDate:date,
        slot:slotTimes[i],
        title:effectiveItem.title,
        masterHash:reusable.masterHash,
      }))
      continue
    }

    const variationSeed = Math.max(0, Number(priorRetry?.retryAttempt || 0))
    let video
    try {
      if (Date.now() < zeroGpuCooldownUntil && !(process.env.CURATED_STOCK_QUOTA_BYPASS === 'true' && planVisualStory({title:effectiveItem.title,script:effectiveItem.script,scriptureReference:effectiveItem.ref}).stockStoryboardAvailable)) throw new Error('FREE_ZEROGPU_QUOTA_COOLDOWN')
      video = await render(effectiveItem, variationSeed)
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : String(error)
      if (/ZeroGPU quota exceeded|exceeded your ZeroGPU quota|FREE_ZEROGPU_QUOTA_COOLDOWN/i.test(failureMessage)) {
        if (Date.now() >= zeroGpuCooldownUntil) {
          zeroGpuCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS
          await writeJsonObject(QUOTA_COOLDOWN_KEY, {until:new Date(zeroGpuCooldownUntil).toISOString(),reason:'FREE_ZEROGPU_QUOTA_EXHAUSTED',publishingLocked:true})
          console.warn('DAILY_FACTORY_ZEROGPU_QUOTA_PAUSE', JSON.stringify({
            targetDate:date,slot:slotTimes[i],cooldownMs:QUOTA_COOLDOWN_MS,
            retryAt:new Date(zeroGpuCooldownUntil).toISOString(),publishingLocked:true
          }))
        }
      }
      const failedEntry = {
        slot:slotTimes[i], title:effectiveItem.title, script:effectiveItem.script, scriptureReference:effectiveItem.ref, caption:effectiveItem.caption, replacement,
        publishingLocked:true, releaseStatus:'PRODUCTION_RETRY', renderQualityGate:'BLOCK',
        failureReason:error instanceof Error ? error.message : String(error),
        scheduledPublishAt:new Date(slotTimestamp(date, slotTimes[i])).toISOString(),
        retryEligible:true, retryAttempt:variationSeed + 1, failedAt:new Date().toISOString()
      }
      entries.push(failedEntry)
      const partial = {ok:false,partial:true,mission:'ONE MILLION SOULS • ONE MISSION • ONE SAVIOUR',pipelineVersion:PIPELINE_VERSION,targetDate:date,timezone:TIMEZONE,generatedAt:new Date().toISOString(),publishingLocked:true,releaseStandard:'PROFESSIONAL_MASTER',requiredApprovals:50,entries}
      await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:buildingKey,Body:JSON.stringify(partial,null,2),ContentType:'application/json',CacheControl:'no-store'}))
      console.error('DAILY_FACTORY_ITEM_QUARANTINED', JSON.stringify({targetDate:date,slot:slotTimes[i],title:effectiveItem.title,error:failedEntry.failureReason}))
      continue
    }
    const releasePayload = {
      title:effectiveItem.title,
      script:effectiveItem.script,
      scriptureReference:effectiveItem.ref,
      caption:effectiveItem.caption,
      mediaUrl:video.mediaUrl,
      masterHash:video.masterHash,
      thumbnailUrl:video.thumbnailUrl,
      thumbnailHash:video.thumbnailHash,
      slot:slotTimes[i],
      targetDate:date,
      scheduledPublishAt:new Date(slotTimestamp(date, slotTimes[i])).toISOString(),
      aiDisclosure:true,
      platforms:['tiktok','youtube'],
      platformPackages:{
        tiktok:{
          caption:effectiveItem.caption,
          privacyLevel:'PUBLIC_TO_EVERYONE',
          isAigc:true,
        },
        youtube:{
          title:effectiveItem.title,
          description:effectiveItem.caption,
          privacyStatus:'public',
          madeForKids:false,
          isAiGeneratedContent:true,
        },
      },
    }
    const contentHash = crypto.createHash('sha256').update(JSON.stringify(canonicalize(releasePayload))).digest('hex')
    const entry = {
      slot:slotTimes[i],
      title:effectiveItem.title,
      script:effectiveItem.script,
      scriptureReference:effectiveItem.ref,
      caption:effectiveItem.caption,
      releasePayload,
      variationSeed,
      mediaUrl:video.mediaUrl,
      width:video.width,
      height:video.height,
      fps:video.fps,
      durationSeconds:video.durationSeconds,
      aiDisclosure:true,
      renderer:video.renderer,
      masterHash:video.masterHash,
      thumbnailUrl:video.thumbnailUrl,
      thumbnailHash:video.thumbnailHash,
      reviewAssets:video.reviewAssets,
      contentHash,
      renderQualityGate:'PASS',
      professionalMasterCandidate:video.professionalMasterCandidate === true,
      masterReady:false,
      technicalMaster:'PENDING',
      creativeMaster:'PENDING',
      masterInspection:video.masterInspection,
      fullDecodeInspection:video.fullDecodeInspection,
      audioInspection:video.audioInspection,
      captionInspection:video.captionInspection,
      visualVarietyInspection:video.visualVarietyInspection,
      visualStoryboardInspection:video.visualStoryboardInspection,
      storyboardVersion:video.storyboardVersion,
      sceneMotionInspection:video.sceneMotionInspection,
      sceneCount:video.sceneCount,
      sceneSources:video.sceneSources,
      rightsClearedStockScenes:video.rightsClearedStockScenes || [],
      voiceProvider:video.voiceProvider,
      voiceRights:video.voiceRights,
      musicRights:video.musicRights,
      imageProvider:video.imageProvider,
      videoProvider:video.videoProvider,
      musicProvider:video.musicProvider,
      releaseStandard:'PROFESSIONAL_MASTER',
      requiredApprovals:50,
      publishingLocked:true,
      releaseStatus:'AWAITING_MASTER_CERTIFICATION',
      scheduledPublishAt:releasePayload.scheduledPublishAt,
      releaseReadyDeadline:new Date(slotTimestamp(date, slotTimes[i]) - RELEASE_READY_BUFFER_MS).toISOString(),
      minimumReleaseReadyBufferHours:2,
    }
    entries.push(entry)

    const partial = {
      ok:true,
      partial:true,
      mission:'ONE MILLION SOULS • ONE MISSION • ONE SAVIOUR',
      pipelineVersion:PIPELINE_VERSION,
      targetDate:date,
      timezone:TIMEZONE,
      generatedAt:new Date().toISOString(),
      publishingLocked:true,
      releaseStandard:'PROFESSIONAL_MASTER',
      requiredApprovals:50,
      entries,
    }
    await s3.send(new PutObjectCommand({
      Bucket:process.env.BUCKET,
      Key:buildingKey,
      Body:JSON.stringify(partial,null,2),
      ContentType:'application/json',
      CacheControl:'no-store',
    }))
    console.log('DAILY_FACTORY_PARTIAL_SAVED', JSON.stringify({
      targetDate:date,
      completed:entries.length,
      slot:entry.slot,
      title:entry.title,
      masterHash:entry.masterHash,
    }))
  }
  const complete = entries.length === slotTimes.length && entries.every(e => e?.renderQualityGate === 'PASS')
  const manifest = {ok:complete,mission:'ONE MILLION SOULS • ONE MISSION • ONE SAVIOUR',pipelineVersion:PIPELINE_VERSION,targetDate:date,timezone:TIMEZONE,generatedAt:new Date().toISOString(),publishingLocked:true,releaseStandard:'PROFESSIONAL_MASTER',requiredApprovals:50,entries}
  // Preserve accessible old exact masters in the public review manifest while
  // the building manifest retains PRODUCTION_RETRY for autonomous repair.
  // Never treat preserved outdated masters as approved or release-ready.
  if(!complete){
    // Search both persisted records: the public manifest may already have
    // been partially overwritten, while the building record can retain an
    // intact exact master. Preserve the complete immutable release payload.
    const historical=[...(Array.isArray(existing?.entries)?existing.entries:[]),
      ...(Array.isArray(previousBuilding?.entries)?previousBuilding.entries:[])]
    manifest.entries=entries.map(entry=>{
      if(entry?.releaseStatus!=='PRODUCTION_RETRY')return entry
      const old=historical.find(prior=>prior?.slot===entry.slot &&
        /^[a-f0-9]{64}$/i.test(String(prior?.masterHash||'')) &&
        prior?.mediaUrl && prior?.releasePayload?.masterHash===prior.masterHash)
      return old?{...old,releaseStatus:'TECHNICAL_BLOCK_REGENERATION_PENDING',
        publishingLocked:true,renderQualityGate:'BLOCK',retryEligible:true,
        failureReason:entry.failureReason,failedAt:entry.failedAt}:entry
    })
  }
  const body = JSON.stringify(manifest,null,2)
  await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:key,Body:body,ContentType:'application/json',CacheControl:'no-store'}))
  if (complete) await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:'manifests/latest.json',Body:body,ContentType:'application/json',CacheControl:'no-store'}))
  console.log(complete ? 'DAILY_FACTORY_SUCCESS' : 'DAILY_FACTORY_PARTIAL_FAILURE', JSON.stringify({targetDate:date,pipelineVersion:PIPELINE_VERSION,publishingLocked:true,entries:entries.map(e=>({slot:e.slot,title:e.title,mediaUrl:e.mediaUrl,masterHash:e.masterHash,contentHash:e.contentHash,releaseStatus:e.releaseStatus}))}))
  return complete
}

async function readQuotaCooldown(){
  try {
    const result = await s3.send(new GetObjectCommand({Bucket:process.env.BUCKET,Key:QUOTA_COOLDOWN_KEY}))
    const payload = JSON.parse(await result.Body.transformToString())
    const until = Date.parse(String(payload?.until || ''))
    if (!Number.isFinite(until)) throw new Error('INVALID_QUOTA_COOLDOWN_RECORD')
    return until
  } catch (error) {
    const code = error?.name || error?.Code || ''
    if (code === 'NoSuchKey' || code === 'NotFound') return 0
    throw new Error('QUOTA_COOLDOWN_READ_FAILED: '+String(error?.message || error))
  }
}

async function writeJsonObject(key,value){
  if(!s3)throw new Error('Persistent storage unavailable')
  await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:key,Body:JSON.stringify(value,null,2),ContentType:'application/json',CacheControl:'no-store'}))
}

export async function requestFactoryRetry({date,slot,expectedMasterHash,reason='CERTIFICATION_BLOCK',replacement=null}={}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))throw new Error('VALID_RETRY_DATE_REQUIRED')
  const slots=configuredSlots()
  if(!slots.includes(String(slot||'')))throw new Error('VALID_RETRY_SLOT_REQUIRED')
  if(!/^[a-f0-9]{64}$/i.test(String(expectedMasterHash||'')))throw new Error('VALID_EXPECTED_MASTER_HASH_REQUIRED')
  const current=await readJsonObject(manifestKey(date))
  const building=await readJsonObject(buildingManifestKey(date))
  const source=(building?.pipelineVersion===PIPELINE_VERSION&&building?.targetDate===date)?building:current
  const entries=Array.isArray(source?.entries)?source.entries:[]
  const target=entries.find((e)=>e?.slot===slot&&String(e?.masterHash||'').toLowerCase()===String(expectedMasterHash).toLowerCase())
  if(!target)throw new Error('EXACT_RETRY_MASTER_NOT_FOUND')
  const retryAttempt=Math.max(1,Number(target?.variationSeed||0)+1,Number(target?.retryAttempt||0))
  const cleanReplacement = replacement && typeof replacement === 'object' ? {
    title:String(replacement.title || target.title || '').slice(0,120),
    ref:String(replacement.ref || replacement.scriptureReference || target.scriptureReference || '').slice(0,120),
    script:String(replacement.script || target.script || '').slice(0,3500),
    caption:String(replacement.caption || target.caption || '').slice(0,2200),
  } : null
  if(cleanReplacement && (!cleanReplacement.title || !cleanReplacement.script || !cleanReplacement.ref || !cleanReplacement.caption))throw new Error('REPLACEMENT_CONTENT_INCOMPLETE')
  const retryEntry={
    slot,targetDate:date,title:target.title,script:target.script,scriptureReference:target.scriptureReference,caption:target.caption,
    replacement:cleanReplacement,
    publishingLocked:true,releaseStatus:'PRODUCTION_RETRY',renderQualityGate:'BLOCK',retryEligible:true,retryAttempt,
    failureReason:String(reason||'CERTIFICATION_BLOCK').slice(0,4000),scheduledPublishAt:target.scheduledPublishAt,failedAt:new Date().toISOString()
  }
  const retryEntries=entries.map((e)=>e?.slot===slot?retryEntry:e)
  const retryManifest={...(source||{}),ok:false,partial:true,pipelineVersion:PIPELINE_VERSION,targetDate:date,generatedAt:new Date().toISOString(),publishingLocked:true,entries:retryEntries}
  await writeJsonObject(buildingManifestKey(date),retryManifest)
  await writeJsonObject(manifestKey(date),retryManifest)
  lastFactoryDate=''
  nextFactoryAttemptAt=0
  setTimeout(()=>generateFor(date).catch((error)=>console.error('DAILY_FACTORY_RETRY_ERROR',error instanceof Error?error.message:String(error))),25)
  console.warn('DAILY_FACTORY_RETRY_REQUESTED',JSON.stringify({date,slot,expectedMasterHash,retryAttempt,reason:String(reason||'').slice(0,500)}))
  return {ok:true,date,slot,expectedMasterHash,retryAttempt,publishingLocked:true}
}

let lastFactoryDate = ''
let nextFactoryAttemptAt = 0
const FACTORY_RETRY_MS = Number(process.env.DAILY_FACTORY_RETRY_MS || 15 * 60 * 1000)

async function tick() {
  const now = localDate()
  const target = tomorrowDate()
  if (Date.now() < nextFactoryAttemptAt) return
  const runKey = `${now.date}:${ADVANCE_DAYS}`
  if (lastFactoryDate === runKey) return
  if (now.time === '23:30' || lastFactoryDate === '') {
    lastFactoryDate = runKey
    try {
      let allComplete = true
      for (let day=1; day<=ADVANCE_DAYS; day++) {
        const complete = await generateFor(futureDate(day))
        if (complete !== true) allComplete = false
      }
      if (allComplete) {
        nextFactoryAttemptAt = 0
      } else {
        lastFactoryDate = ''
        nextFactoryAttemptAt = Math.max(Date.now() + FACTORY_RETRY_MS, zeroGpuCooldownUntil)
        console.warn('DAILY_FACTORY_INCOMPLETE_BACKOFF', JSON.stringify({retryAfterMs:FACTORY_RETRY_MS,retryAt:new Date(nextFactoryAttemptAt).toISOString()}))
      }
    } catch (e) {
      lastFactoryDate=''
      nextFactoryAttemptAt = Math.max(Date.now() + FACTORY_RETRY_MS, zeroGpuCooldownUntil)
      console.error('DAILY_FACTORY_ERROR', e instanceof Error ? e.message : String(e))
      console.error('DAILY_FACTORY_BACKOFF', JSON.stringify({ retryAfterMs: FACTORY_RETRY_MS, retryAt: new Date(nextFactoryAttemptAt).toISOString() }))
    }
  }
}

console.log('DAILY_FACTORY', JSON.stringify({enabled,storageReady,timezone:TIMEZONE,bankSize:BANK.length,advanceDays:ADVANCE_DAYS,releaseModel:'PRODUCE_AHEAD_THEN_CERTIFY'}))
setTimeout(()=>tick(),3000)
setInterval(()=>tick(),30_000)
