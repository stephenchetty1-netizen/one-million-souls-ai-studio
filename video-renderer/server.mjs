import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { renderFreeV2 } from './free-ai-render-v2.mjs'
import { requestFactoryRetry } from './daily-factory.mjs'
import { stagePexelsCollection } from './pexels-source-import.mjs'
import { stageChristianPexelsFormat } from './pexels-format-library.mjs'
import { renderChristianMusicVideoDraft,inspectChristianVideoFormatReadiness } from './christian-music-video.mjs'
import { renderChristianNarratedShortDraft } from './christian-narrated-short.mjs'
import { searchStoredMasterCandidates } from './master-archive-search.mjs'
import { CHRISTIAN_VIDEO_FORMATS } from './christian-video-formats.mjs'
import { christianSourceReviewQueue, christianReviewSourceObject, recordChristianSourceReview } from './christian-source-review-workflow.mjs'
import { inspectCurrentReviewedShortDraft } from './christian-reviewed-draft-integrity.mjs'
import { worshipMediaRevoked, REVOKED_WORSHIP_MEDIA_KEYS } from './christian-visual-editorial-gate.mjs'

const execFileAsync = promisify(execFile)
const PORT = Number(process.env.PORT || 3000)
const SECRET = process.env.VIDEO_RENDER_SECRET || ''
const WIDTH = Number(process.env.RENDER_WIDTH || 720)
const HEIGHT = Number(process.env.RENDER_HEIGHT || 1280)
const FPS = Number(process.env.RENDER_FPS || 24)
const publicBase = () => {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  return `http://127.0.0.1:${PORT}`
}

const storageReady = Boolean(
  process.env.ENDPOINT &&
  process.env.BUCKET &&
  process.env.REGION &&
  process.env.ACCESS_KEY_ID &&
  process.env.SECRET_ACCESS_KEY
)

const s3 = storageReady ? new S3Client({
  endpoint: process.env.ENDPOINT,
  region: process.env.REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
}) : null

const localFiles = new Map()

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function authorized(req) {
  if (!SECRET) return true
  return req.headers.authorization === `Bearer ${SECRET}`
}


// Short-lived, signed, HttpOnly reviewer session. Source MP4s stay private and
// are streamed only after authentication; no storage credentials enter URLs.
function reviewSessionValid(req){
 if(!SECRET)return false
 const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim())
  .find(x=>x.startsWith('oms_christian_review='))
 if(!raw)return false
 const token=raw.slice('oms_christian_review='.length)
 const [time,signature]=token.split('.')
 if(!/^\d{13}$/.test(time)||!/^[a-f0-9]{64}$/.test(signature||''))return false
 if(Date.now()-Number(time)>2*60*60*1000||Number(time)>Date.now()+60000)return false
 const expected=crypto.createHmac('sha256',SECRET).update('christian-review:'+time).digest('hex')
 return crypto.timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex'))
}
function reviewerAuthorized(req){return Boolean(SECRET)&&(authorized(req)||reviewSessionValid(req))}
function reviewerOriginValid(req){
 if(!req.headers.origin)return true
 try{return new URL(req.headers.origin).host===req.headers.host}catch{return false}
}

// Keep the exact-source approval as the gate, but make approved-bank renders
// self-healing across restarts. No job here can certify or publish a master.
const reviewedDraftJobs=new Set()
function queueReviewedChristianDraft(format,trigger,attempt=1){
 if(!['SHORT_59','YOUTUBE_LONG'].includes(format))return
 if(reviewedDraftJobs.has(format))return
 reviewedDraftJobs.add(format)
 void (async()=>{
   try{
     const draft=format==='SHORT_59'
       ?await renderChristianNarratedShortDraft()
       :await renderChristianMusicVideoDraft({format:'YOUTUBE_LONG'})
     console.log('CHRISTIAN_REVIEWED_SOURCE_DRAFT_READY',JSON.stringify({
       format,trigger,attempt,masterHash:draft.masterHash,mediaUrl:draft.mediaUrl,
       voiceover:draft.voiceover===true||draft.narrationPresent===true,
       captionsPresent:draft.captionsPresent===true||draft.onScreenWords===true,
       certification:'NOT_CERTIFIED',publishingAllowed:false
     }))
   }catch(error){
     console.error('CHRISTIAN_REVIEWED_SOURCE_DRAFT_FAILED',JSON.stringify({
       format,trigger,attempt,maxAttempts:3,
       reason:String(error?.message||error).slice(0,1200),publishingAllowed:false
     }))
     if(attempt<3){
       const waitMs=attempt*90000
       setTimeout(()=>queueReviewedChristianDraft(format,'AUTONOMOUS_RETRY',attempt+1),waitMs)
     }
   }finally{
     reviewedDraftJobs.delete(format)
   }
 })()
}

async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > 2_000_000) throw new Error('Request body too large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function firstString(...values) {
  return values.find((v) => typeof v === 'string' && v.trim())?.trim() || ''
}

function extractTitle(body) {
  return firstString(
    body?.title,
    body?.campaign?.title,
    body?.asset?.title,
    body?.platformPackages?.youtube?.title,
    body?.asset?.platformPackages?.youtube?.title,
    body?.campaign?.platformPackages?.youtube?.title,
    body?.topic,
    body?.campaign?.topic,
    'ONE MILLION SOULS'
  ).slice(0, 120)
}

function extractScript(body) {
  const candidates = [
    body?.script,
    body?.campaign?.script,
    body?.campaign?.content,
    body?.campaign?.message,
    body?.asset?.script,
    body?.asset?.content,
    body?.platformPackages?.youtube?.description,
    body?.asset?.platformPackages?.youtube?.description,
    body?.campaign?.platformPackages?.youtube?.description,
    body?.platformPackages?.tiktok?.caption,
    body?.asset?.platformPackages?.tiktok?.caption,
    body?.campaign?.platformPackages?.tiktok?.caption,
    body?.campaign?.hook,
    body?.topic,
    body?.campaign?.topic,
  ].filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())

  if (!candidates.length) {
    return 'Jesus is faithful. Keep trusting God, keep praying, and do not give up. Your story is still being written.'
  }

  const longest = candidates.sort((a, b) => b.length - a.length)[0]
  return longest.slice(0, 3500)
}

function escSrt(text) {
  return text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const x = ms % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(x).padStart(3, '0')}`
}

function buildSrt(script, duration) {
  const words = escSrt(script).split(' ').filter(Boolean)
  const chunks = []
  for (let i = 0; i < words.length; i += 7) chunks.push(words.slice(i, i + 7).join(' '))
  if (!chunks.length) chunks.push('ONE MILLION SOULS')
  const slice = Math.max(1.3, duration / chunks.length)
  return chunks.map((text, i) => {
    const start = i * slice
    const end = Math.min(duration, (i + 1) * slice)
    return `${i + 1}\n${srtTime(start)} --> ${srtTime(Math.max(start + 0.8, end))}\n${text}\n`
  }).join('\n')
}

async function renderVideo(body) {
  const id = crypto.randomUUID()
  const work = path.join(os.tmpdir(), 'one-million-souls-renderer', id)
  await fs.mkdir(work, { recursive: true })

  const script = extractScript(body)
  const title = extractTitle(body)
  const scriptPath = path.join(work, 'script.txt')
  const titlePath = path.join(work, 'title.txt')
  const wavPath = path.join(work, 'voice.wav')
  const srtPath = path.join(work, 'captions.srt')
  const mp4Path = path.join(work, 'video.mp4')

  await fs.writeFile(scriptPath, script, 'utf8')
  await fs.writeFile(titlePath, title, 'utf8')

  await execFileAsync('espeak-ng', [
    '-v', process.env.TTS_VOICE || 'en-us',
    '-s', process.env.TTS_SPEED || '150',
    '-f', scriptPath,
    '-w', wavPath,
  ], { timeout: 120_000 })

  let duration = Math.max(8, Math.min(60, script.split(/\s+/).length / 2.2))
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      wavPath,
    ], { timeout: 30_000 })
    const parsed = Number.parseFloat(stdout.trim())
    if (Number.isFinite(parsed) && parsed > 0) duration = Math.min(60, parsed)
  } catch {}

  await fs.writeFile(srtPath, buildSrt(script, duration), 'utf8')

  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  const filter = [
    `drawtext=fontfile=${font}:textfile=${titlePath}:fontcolor=white:fontsize=42:x=(w-text_w)/2:y=120:box=1:boxcolor=black@0.38:boxborderw=18`,
    `subtitles=${srtPath}:force_style='FontName=DejaVu Sans,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=140'`,
    `drawtext=fontfile=${font}:text='ONE MILLION SOULS • ONE MISSION • ONE SAVIOUR':fontcolor=white@0.92:fontsize=20:x=(w-text_w)/2:y=h-80`,
  ].join(',')

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=0x071A33:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${Math.max(8, duration + 0.5).toFixed(2)}`,
    '-i', wavPath,
    '-filter_threads', '1',
    '-vf', filter,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'stillimage',
    '-crf', '27',
    '-threads', '2',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-movflags', '+faststart',
    mp4Path,
  ], { timeout: 300_000, maxBuffer: 20 * 1024 * 1024 })

  const key = `renders/${new Date().toISOString().slice(0, 10)}/${id}.mp4`
  const bytes = await fs.readFile(mp4Path)

  if (s3) {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.BUCKET,
      Key: key,
      Body: bytes,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
    }))
  } else {
    localFiles.set(key, mp4Path)
  }

  const mediaUrl = `${publicBase()}/media/${key.split('/').map(encodeURIComponent).join('/')}`

  return {
    ok: true,
    renderer: 'one-million-souls-offline-renderer-v1',
    mediaUrl,
    width: WIDTH,
    height: HEIGHT,
    durationSeconds: Number(duration.toFixed(2)),
    captionsPresent: true,
    audioPresent: true,
    rightsCleared: true,
    scriptureIntegrity: true,
    rendererPreservedScript: true,
    persistentStorage: Boolean(s3),
    dryRun: body?.dryRun === true,
  }
}

async function readStoredJson(key) {
  if (!s3) throw new Error('Persistent storage unavailable')
  const result = await s3.send(new GetObjectCommand({ Bucket: process.env.BUCKET, Key: key }))
  const text = await result.Body?.transformToString()
  if (!text) throw new Error('Stored JSON empty')
  return JSON.parse(text)
}

async function serveMedia(req, res, key) {
  try {
    if (s3) {
      const result = await s3.send(new GetObjectCommand({ Bucket: process.env.BUCKET, Key: key }))
      res.writeHead(200, {
        'content-type': result.ContentType || 'video/mp4',
        'cache-control': result.CacheControl || 'public, max-age=31536000, immutable',
      })
      result.Body.pipe(res)
      return
    }
    const local = localFiles.get(key)
    if (!local) return sendJson(res, 404, { ok: false, error: 'Media not found' })
    const data = await fs.readFile(local)
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': data.length })
    res.end(data)
  } catch (error) {
    sendJson(res, 404, { ok: false, error: error instanceof Error ? error.message : 'Media not found' })
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    return sendJson(res, 200, {
      ok: true,
      service: 'one-million-souls-video-renderer',
      ffmpeg: true,
      offlineTts: true,
      legacyRendererEnabled: false,
      productionRenderer: '/render-v2',
      v2RendererReady: true,
      googleFlowClassVeoConfigured: Boolean(String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim()),
      googleVeoEnabled: process.env.GOOGLE_VEO_ENABLED !== 'false' && Boolean(String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim()),
      googleVeoPrimary: process.env.GOOGLE_VEO_PRIMARY !== 'false',
      googleVeoModel: process.env.GOOGLE_VEO_MODEL || 'veo-3.1-generate-preview',
      googleVeoResolution: process.env.GOOGLE_VEO_RESOLUTION || '1080p',
      persistentStorage: storageReady,
      renderProfile: `${WIDTH}x${HEIGHT}@${FPS}`,
    })
  }

  if (req.method === 'GET' && url.pathname === '/factory-manifest') {
    if (!authorized(req)) return sendJson(res, 401, { ok:false, error:'Unauthorized' })
    const date = url.searchParams.get('date') || 'latest'
    if (date !== 'latest' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { ok:false, error:'date must be YYYY-MM-DD or latest' })
    try {
      const building = url.searchParams.get('stage') === 'building'
      if(building && date === 'latest') return sendJson(res,400,{ok:false,error:'building stage requires a date'})
      const key = date === 'latest' ? 'manifests/latest.json' : `manifests/${date}${building ? '.building' : ''}.json`
      const manifest = await readStoredJson(key)
      return sendJson(res, 200, manifest)
    } catch (error) {
      return sendJson(res, 404, { ok:false, error:error instanceof Error ? error.message : 'Manifest not found' })
    }
  }

  if (req.method === 'POST' && url.pathname === '/factory-retry') {
    if (!authorized(req)) return sendJson(res, 401, { ok:false, error:'Unauthorized' })
    try {
      const body = await readJson(req)
      const result = await requestFactoryRetry({
        date:body?.date,
        slot:body?.slot,
        expectedMasterHash:body?.expectedMasterHash,
        reason:body?.reason,
        replacement:body?.replacement,
      })
      return sendJson(res, 202, result)
    } catch (error) {
      return sendJson(res, 409, { ok:false, blocked:true, error:error instanceof Error ? error.message : 'Factory retry rejected' })
    }
  }


  // Authenticated, source-hash-specific human visual review. This workflow
  // NEVER approves a final master or enables automatic social posting.
  if(req.method==='GET'&&url.pathname==='/christian-review'){
    try{
      const html=await fs.readFile(path.join(process.cwd(),'christian-review.html'),'utf8')
      res.writeHead(200,{'content-type':'text/html; charset=utf-8',
        'cache-control':'private, no-store','x-content-type-options':'nosniff',
        'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"})
      return res.end(html)
    }catch(error){return sendJson(res,503,{ok:false,error:'REVIEW_PORTAL_UNAVAILABLE'})}
  }
  if(req.method==='GET'&&url.pathname==='/christian-review.js'){
    try{
      const script=await fs.readFile(path.join(process.cwd(),'christian-review.js'),'utf8')
      res.writeHead(200,{'content-type':'application/javascript; charset=utf-8',
        'cache-control':'private, no-store','x-content-type-options':'nosniff'})
      return res.end(script)
    }catch{return sendJson(res,503,{ok:false,error:'REVIEW_PORTAL_SCRIPT_UNAVAILABLE'})}
  }
  if(req.method==='POST'&&url.pathname==='/christian-review-login'){
    if(!SECRET||!reviewerOriginValid(req))return sendJson(res,403,{ok:false,error:'REVIEW_LOGIN_UNAVAILABLE'})
    try{
      const body=await readJson(req)
      const proposed=crypto.createHash('sha256').update(String(body?.secret||'')).digest()
      const expected=crypto.createHash('sha256').update(SECRET).digest()
      if(!crypto.timingSafeEqual(proposed,expected))return sendJson(res,401,{ok:false,error:'INVALID_REVIEWER_CREDENTIALS'})
      const at=String(Date.now())
      const mac=crypto.createHmac('sha256',SECRET).update('christian-review:'+at).digest('hex')
      res.setHeader('set-cookie','oms_christian_review='+at+'.'+mac+
        '; HttpOnly; Secure; SameSite=Strict; Max-Age=7200; Path=/')
      return sendJson(res,200,{ok:true,sessionMinutes:120,publishingAllowed:false})
    }catch{return sendJson(res,400,{ok:false,error:'INVALID_REVIEW_LOGIN_REQUEST'})}
  }
  if(req.method==='GET'&&url.pathname==='/christian-review-queue'){
    if(!reviewerAuthorized(req))return sendJson(res,401,{ok:false,error:'REVIEWER_AUTH_REQUIRED'})
    try{return sendJson(res,200,await christianSourceReviewQueue(url.searchParams.get('format')||'SHORT_59'))}
    catch(error){return sendJson(res,409,{ok:false,error:String(error?.message||error),publishingAllowed:false})}
  }
  if(req.method==='GET'&&url.pathname==='/christian-review-video'){
    if(!reviewerAuthorized(req))return sendJson(res,401,{ok:false,error:'REVIEWER_AUTH_REQUIRED'})
    try{
      const {result,hash}=await christianReviewSourceObject(
        url.searchParams.get('format')||'SHORT_59',url.searchParams.get('id'),req.headers.range)
      res.writeHead(result.ContentRange?206:200,{
        'content-type':'video/mp4','cache-control':'private, no-store',
        'accept-ranges':'bytes','x-source-sha256':hash,
        'x-content-type-options':'nosniff',
        ...(result.ContentLength?{'content-length':result.ContentLength}:{}),
        ...(result.ContentRange?{'content-range':result.ContentRange}:{}),
      })
      return result.Body.pipe(res)
    }catch(error){return sendJson(res,404,{ok:false,error:String(error?.message||error)})}
  }
  if(req.method==='POST'&&url.pathname==='/christian-review-decision'){
    if(!reviewerAuthorized(req)||!reviewerOriginValid(req))
      return sendJson(res,401,{ok:false,error:'REVIEWER_AUTH_REQUIRED'})
    try{
      const body=await readJson(req)
      const result=await recordChristianSourceReview(body?.format||'SHORT_59',body)
      // A fully reviewed source bank automatically starts a zero-credit FFmpeg
      // draft; independent exact-master certification still remains mandatory.
      sendJson(res,200,result)
      if(result.decision==='REJECT'){
        // Replace rejected originals automatically; replacement is a NEW
        // unreviewed candidate and cannot inherit the old source's approval.
        void stageChristianPexelsFormat(result.format)
          .then(staged=>console.log('CHRISTIAN_REJECTED_SOURCE_REPLACEMENT',JSON.stringify({
            format:result.format,staged:staged.staged,sourceClips:staged.sourceClips,
            reviewed:staged.christianVisualReviewedClips,publishingAllowed:false
          })))
          .catch(error=>console.error('CHRISTIAN_REJECTED_SOURCE_REPLACEMENT_FAILED',
            JSON.stringify({format:result.format,error:String(error?.message||error),
              publishingAllowed:false})))
      }
      if(result.sourceBankReady&&result.decision==='APPROVE'){
        queueReviewedChristianDraft(result.format,'LAST_SOURCE_APPROVED')
      }
      return
    }catch(error){return sendJson(res,409,{ok:false,error:String(error?.message||error),publishingAllowed:false})}
  }

  // Read-only archive audit for any previously certified exact MP4. A
  // matching R2 JSON alone is insufficient: this endpoint rehashes the file
  // and explicitly withholds any 50-agent Redis release certification.
  if(req.method==='GET'&&url.pathname==='/christian-master-search'){
    if(!reviewerAuthorized(req))return sendJson(res,401,{ok:false,error:'REVIEWER_AUTH_REQUIRED'})
    try{
      const report=await searchStoredMasterCandidates({
        endpoint:process.env.ENDPOINT,region:process.env.REGION,
        bucket:process.env.BUCKET,accessKeyId:process.env.ACCESS_KEY_ID,
        secretAccessKey:process.env.SECRET_ACCESS_KEY,
        rendererHost:process.env.RAILWAY_PUBLIC_DOMAIN||
          new URL(publicBase()).host
      })
      return sendJson(res,200,report)
    }catch(error){
      return sendJson(res,503,{ok:false,error:String(error?.message||error),
        certifiedMasterClaimAllowed:false,publishingAllowed:false})
    }
  }

  if (req.method === 'GET' && url.pathname === '/christian-video-formats') {
    if (!authorized(req)) return sendJson(res,401,{ok:false,error:'Unauthorized'})
    try{
      const [shorts,youtube]=await Promise.all([
        inspectChristianVideoFormatReadiness('SHORT_59'),
        inspectChristianVideoFormatReadiness('YOUTUBE_LONG')
      ])
      return sendJson(res,200,{ok:true,formats:CHRISTIAN_VIDEO_FORMATS,
        sourceReadiness:{SHORT_59:shorts,YOUTUBE_LONG:youtube},
        publishingAllowed:false,automaticPosting:false})
    }catch(error){
      return sendJson(res,503,{ok:false,error:String(error?.message||error),
        publishingAllowed:false})
    }
  }

  // Preview the complete narrated 59-second edit *before* the 9 source
  // approvals are recorded. The preview remains quarantined in private R2,
  // is never a certified master, and cannot be addressed through /media/.
  if(req.method==='GET'&&url.pathname==='/christian-preview-latest'){
    if(!reviewerAuthorized(req))return sendJson(res,401,{ok:false,error:'REVIEWER_AUTH_REQUIRED'})
    try{
      const latest=await readStoredJson('internal/unreviewed-narrated-short-reviews/v1/latest.json')
      return sendJson(res,200,{ok:true,id:latest.id,masterHash:latest.masterHash,
        mediaUrl:'/christian-private-preview?kind=video&id='+latest.id,
        contactSheetUrl:'/christian-private-preview?kind=contact&id='+latest.id,
        editorialStatus:latest.editorialStatus,
        unreviewedSourcePreview:true,sourceReviewRequired:true,
        certified:false,masterReady:false,publishingAllowed:false})
    }catch(error){return sendJson(res,404,{ok:false,error:'PRIVATE_PREVIEW_NOT_YET_RENDERED',
      publishingAllowed:false})}
  }
  // Reviewed SOURCE footage produces a reviewable FINAL draft, not a certificate.
  // Preserve its hash-bound lookup through any Railway renderer restart.
  if(req.method==='GET'&&url.pathname==='/christian-reviewed-draft-latest'){
    if(!reviewerAuthorized(req))return sendJson(res,401,{ok:false,error:'REVIEWER_AUTH_REQUIRED'})
    try{
      const latest=await readStoredJson('internal/narrated-short-reviews/v1/latest.json')
      if(!latest||latest.unreviewedSourcePreview===true||latest.sourceReviewRequired===true||
         !/^[a-f0-9]{64}$/i.test(String(latest.masterHash||''))||
         latest.measured?.fullDecodePassed!==true||
         !Array.isArray(latest.sourceScenes)||latest.sourceScenes.length!==9)
        throw new Error('REVIEWED_DRAFT_NOT_READY')
      const sourceManifest=await readStoredJson('internal/pexels-source-candidates/v1/BE_STILL_PEXELS_V1/manifest.json')
      const integrity=inspectCurrentReviewedShortDraft(latest,sourceManifest)
      if(!integrity.ready)throw new Error('REVIEWED_DRAFT_SOURCE_REVOKED_OR_CHANGED: '+integrity.blockers.join(';'))
      return sendJson(res,200,{
        ok:true,id:latest.id,title:latest.title,masterHash:latest.masterHash,
        mediaUrl:latest.mediaUrl,contactSheetUrl:latest.contactSheetUrl,
        sourceClips:latest.sourceScenes.length,voiceover:latest.voiceover===true,
        captionsPresent:latest.captionsPresent===true,
        editorialStatus:latest.editorialStatus,
        certification:'NOT_CERTIFIED',masterReady:false,publishingAllowed:false
      })
    }catch(error){return sendJson(res,404,{ok:false,error:'REVIEWED_SOURCE_DRAFT_NOT_YET_RENDERED',publishingAllowed:false})}
  }
  if(req.method==='GET'&&url.pathname==='/christian-private-preview'){
    if(!reviewerAuthorized(req))return sendJson(res,401,{ok:false,error:'REVIEWER_AUTH_REQUIRED'})
    const id=String(url.searchParams.get('id')||'')
    const kind=String(url.searchParams.get('kind')||'')
    if(!/^[a-f0-9-]{36}$/i.test(id)||!['video','contact'].includes(kind))
      return sendJson(res,400,{ok:false,error:'PRIVATE_PREVIEW_ID_INVALID'})
    try{
      const latest=await readStoredJson('internal/unreviewed-narrated-short-reviews/v1/latest.json')
      if(latest?.id!==id)return sendJson(res,404,{ok:false,error:'PRIVATE_PREVIEW_NOT_FOUND'})
      const range=req.headers.range
      if(range&&!/^bytes=\d{1,12}-\d{0,12}$/.test(range))
        return sendJson(res,416,{ok:false,error:'INVALID_PREVIEW_BYTE_RANGE'})
      const key='internal/unreviewed-narrated-short-draft/v1/'+id+
        (kind==='video'?'.mp4':'-contact.jpg')
      const result=await s3.send(new GetObjectCommand({
        Bucket:process.env.BUCKET,Key:key,...(range?{Range:range}:{})
      }))
      res.writeHead(result.ContentRange?206:200,{
        'content-type':kind==='video'?'video/mp4':'image/jpeg',
        'cache-control':'private, no-store',
        'x-content-type-options':'nosniff',
        'accept-ranges':'bytes',
        ...(result.ContentRange?{'content-range':result.ContentRange}:{}),
        ...(result.ContentLength?{'content-length':result.ContentLength}:{})
      })
      return result.Body.pipe(res)
    }catch(error){return sendJson(res,404,{ok:false,error:'PRIVATE_PREVIEW_NOT_FOUND'})}
  }

  if(req.method==='POST'&&url.pathname==='/christian-narrated-short-draft'){
    if(!authorized(req))return sendJson(res,401,{ok:false,error:'Unauthorized'})
    try{
      const draft=await renderChristianNarratedShortDraft()
      return sendJson(res,200,{ok:true,mediaUrl:draft.mediaUrl,
        masterHash:draft.masterHash,contactSheetUrl:draft.contactSheetUrl,
        script:draft.script,scriptureReference:draft.scriptureReference,
        voiceover:draft.voiceover,captionsPresent:draft.captionsPresent,
        editorialStatus:draft.editorialStatus,certification:draft.certification,
        publishingAllowed:false})
    }catch(error){
      const code=String(error?.message||error)
      console.error('CHRISTIAN_NARRATED_59_SECOND_DRAFT_FAILED',JSON.stringify({
        error:code,publishingAllowed:false}))
      return sendJson(res,/REQUIRES_NINE_REVIEWED|NARRATED_SHORT_ALREADY_RENDERING/.test(code)?409:502,
        {ok:false,error:code,publishingAllowed:false})
    }
  }

  if (req.method === 'POST' && url.pathname === '/christian-music-video-draft') {
    if (!authorized(req)) return sendJson(res,401,{ok:false,error:'Unauthorized'})
    try{
      const body=await readJson(req)
      const result=await renderChristianMusicVideoDraft({format:body?.format||'SHORT_59'})
      return sendJson(res,200,{ok:true,profileId:result.profileId,
        targetSeconds:result.measured?.targetSeconds,mediaUrl:result.mediaUrl,
        masterHash:result.masterHash,contactSheetUrl:result.contactSheetUrl,
        suggestedCaption:result.suggestedCaption,
        editorialStatus:result.editorialStatus,publishingAllowed:false})
    }catch(error){
      const code=String(error?.message||'CHRISTIAN_MUSIC_VIDEO_RENDER_FAILED')
      console.error('CHRISTIAN_MUSIC_VIDEO_DRAFT_FAILED',JSON.stringify({error:code,publishingLocked:true}))
      return sendJson(res,code.startsWith('CHRISTIAN_VIDEO_FORMAT_SOURCES_BLOCKED')?409:502,{ok:false,error:code,publishingAllowed:false})
    }
  }

  if (req.method === 'POST' && url.pathname === '/christian-format-stage') {
    if (!authorized(req)) return sendJson(res,401,{ok:false,error:'Unauthorized'})
    try{
      const body=await readJson(req)
      const result=await stageChristianPexelsFormat(body?.format||'SHORT_59')
      return sendJson(res,result.ok?200:409,result)
    }catch(error){
      const message=String(error?.message||error)
      return sendJson(res,/ALREADY_RUNNING|QUOTA_EXHAUSTED/.test(message)?429:502,{
        ok:false,error:message,publishingAllowed:false
      })
    }
  }

  if (req.method === 'POST' && url.pathname === '/pexels-stage') {
    if (!authorized(req)) return sendJson(res, 401, {ok:false,error:'Unauthorized'})
    try {
      const body=await readJson(req)
      const result=await stagePexelsCollection(body?.collection||'BE_STILL_PEXELS_V1')
      return sendJson(res,200,result)
    } catch(error){
      const code=String(error?.message||'')
      const status=code==='PEXELS_API_KEY_REQUIRED'||code==='PEXELS_PRIVATE_STORAGE_REQUIRED'?409:
        code==='PEXELS_COLLECTION_NOT_APPROVED_FOR_STAGING'?400:502
      return sendJson(res,status,{ok:false,staged:false,publishingLocked:true,error:code})
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
    const key = url.pathname.slice('/media/'.length).split('/').map(decodeURIComponent).join('/')
    // Withdraw rejected devotional footage immediately, even if old public links remain.
    if(worshipMediaRevoked(key))
      return sendJson(res,410,{ok:false,error:'REJECTED_CHRISTIAN_EDITORIAL_FOOTAGE',publishingAllowed:false})
    // Imported source clips are private inputs, not stock files for redistributing.
    if(key==='internal'||key.startsWith('internal/'))
      return sendJson(res,403,{ok:false,error:'PRIVATE_SOURCE_MEDIA_ACCESS_BLOCKED'})
    return serveMedia(req, res, key)
  }

  if (req.method === 'POST' && url.pathname === '/render-v2') {
    if (!authorized(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
    try {
      const body = await readJson(req)
      const result = await renderFreeV2(body)
      return sendJson(res, 200, result)
    } catch (error) {
      console.error(error)
      return sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : 'Render V2 failed',
      })
    }
  }

  if (req.method === 'POST' && (url.pathname === '/render' || url.pathname === '/')) {
    if (!authorized(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
    return sendJson(res, 410, {
      ok: false,
      blocked: true,
      error: 'LEGACY_RENDERER_DISABLED',
      message: 'V59 production rendering must use /render-v2 and pass the PROFESSIONAL_MASTER pipeline. Legacy static/offline rendering cannot produce publishable media.',
      requiredEndpoint: '/render-v2',
    })
  }

  return sendJson(res, 404, { ok: false, error: 'Not found' })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`One Million Souls video renderer listening on ${PORT}`)
  if(process.env.CHRISTIAN_MASTER_ARCHIVE_AUDIT_ON_BOOT==='true'){
    setTimeout(()=>{
      void searchStoredMasterCandidates({
        endpoint:process.env.ENDPOINT,region:process.env.REGION,
        bucket:process.env.BUCKET,accessKeyId:process.env.ACCESS_KEY_ID,
        secretAccessKey:process.env.SECRET_ACCESS_KEY,
        rendererHost:process.env.RAILWAY_PUBLIC_DOMAIN||
          new URL(publicBase()).host
      }).then(report=>console.log('CHRISTIAN_CERTIFIED_ARCHIVE_SEARCH_RESULT',
        JSON.stringify(report)))
        .catch(error=>console.error('CHRISTIAN_CERTIFIED_ARCHIVE_SEARCH_FAILED',
          JSON.stringify({error:String(error?.message||error),
            publishingAllowed:false,certifiedMasterClaimAllowed:false})))
    },10000)
  }
  // Remove the rejected public previews and contact sheets. Keep private
  // provenance records so the rejected exact master is not certified later.
  if(s3){
    void Promise.all(REVOKED_WORSHIP_MEDIA_KEYS.map(async key=>{
      try{
        await s3.send(new DeleteObjectCommand({Bucket:process.env.BUCKET,Key:key}))
        console.log('CHRISTIAN_EDIT_REVOKED_PUBLIC_ASSET',JSON.stringify({key,publishingAllowed:false}))
      }catch(error){
        console.error('CHRISTIAN_EDIT_REVOKED_PUBLIC_ASSET_DELETE_FAILED',JSON.stringify({
          key,reason:String(error?.name||'delete failed'),publishingAllowed:false
        }))
      }
    }))
  }
  // Trigger a single authenticated-provider import on explicit operator opt-in.
  // S3 per-source cache is durable, so a restart does not duplicate downloads.
  // Source clips are NOT made public or promoted to approved video masters.
  if (process.env.PEXELS_STAGE_ON_BOOT === 'true') {
    console.log('PEXELS_BOOT_STAGE_REQUESTED',JSON.stringify({
      collection:'BE_STILL_PEXELS_V1',publishingLocked:true
    }))
    void stagePexelsCollection('BE_STILL_PEXELS_V1')
      .then(async result=>{
        console.log('PEXELS_BOOT_STAGE_RESULT',JSON.stringify(result))
        if(process.env.PEXELS_REVIEW_DRAFT_ON_BOOT!=='true')return
        console.log('PEXELS_REVIEW_DRAFT_START',JSON.stringify({
          collection:'BE_STILL_PEXELS_V1',publishingLocked:true
        }))
        const preview=await renderFreeV2({
          title:'BE STILL',script:'Not every battle is won by doing more. Psalm 46:10 calls us to be still and know that God is God. Make space today to stop the noise, pray, listen, and remember who is truly in control. Stillness is not giving up. It is choosing to trust God instead of letting panic lead you.',
          scriptureReference:'Psalm 46:10',variationSeed:0,
          pexelsReviewCollection:'BE_STILL_PEXELS_V1',
        })
        console.log('PEXELS_REVIEW_DRAFT_RESULT',JSON.stringify({
          collection:'BE_STILL_PEXELS_V1',mediaUrl:preview.mediaUrl,
          masterHash:preview.masterHash,reviewAssets:preview.reviewAssets,
          durationSeconds:preview.durationSeconds,qualityGate:preview.qualityGate,
          professionalMasterCandidate:preview.professionalMasterCandidate,
          visualProductionStatus:preview.visualProductionStatus,
          publishingAllowed:false,publishingLocked:true
        }))
      })
      .catch(error=>console.error('PEXELS_BOOT_STAGE_OR_DRAFT_FAILED',JSON.stringify({
        error:error instanceof Error?error.message:String(error),
        publishingLocked:true
      })))
  }
  if(process.env.CHRISTIAN_PEXELS_STAGE_ON_BOOT==='true'){
    console.log('CHRISTIAN_PEXELS_SOURCE_BOOT_START',JSON.stringify({
      format:'SHORT_59',publishingAllowed:false
    }))
    // Stage the two output formats independently: an invalid Shorts base clip,
    // API error, or incomplete review must not prevent YouTube source preparation.
    // Neither source staging nor a successful technical draft grants publication.
    const stageFormat=async(format,renderOnBoot)=>{
      try{
        const result=await stageChristianPexelsFormat(format)
        const short=format==='SHORT_59'
        console.log(short?'CHRISTIAN_PEXELS_SHORTS_STAGED':'CHRISTIAN_PEXELS_YOUTUBE_STAGED',JSON.stringify(result))
        // Create one quarantined complete narrated video with the already
        // technically verified, NOT YET visually approved source bank.
        // This breaks the review deadlock: judge the real edited master first,
        // then approve/reject each exact source. Publishing remains locked.
        if(short&&!result.ok&&result.technicalSourceReady&&
          process.env.CHRISTIAN_UNREVIEWED_DRAFT_ON_BOOT==='true'&&
          process.env.CHRISTIAN_UNREVIEWED_DRAFT_ENABLED==='true'){
          // Retry a transient zero-credit FFmpeg failure without another manual
          // Railway redeploy. A render is still private, unreviewed and unable
          // to enter the publisher regardless of retry outcome.
          const tryPrivatePreview=async(attempt=1)=>{
            try{
              const draft=await renderChristianNarratedShortDraft({reviewPreview:true})
              console.log('CHRISTIAN_PRIVATE_PREVIEW_BOOT_RESULT',JSON.stringify({
                attempt,id:draft.id,mediaUrl:draft.mediaUrl,
                masterHash:draft.masterHash,certification:'NOT_CERTIFIED',
                sourceReviewRequired:true,publishingAllowed:false
              }))
            }catch(error){
              console.error('CHRISTIAN_PRIVATE_PREVIEW_BOOT_FAILED',JSON.stringify({
                attempt,maxAttempts:3,error:String(error?.message||error).slice(0,1100),
                publishingAllowed:false
              }))
              if(attempt<3){
                const waitMs=attempt*90000
                console.log('CHRISTIAN_PRIVATE_PREVIEW_AUTO_RETRY',JSON.stringify({
                  nextAttempt:attempt+1,waitMs,publishingAllowed:false
                }))
                setTimeout(()=>{void tryPrivatePreview(attempt+1)},waitMs)
              }
            }
          }
          void tryPrivatePreview()
        }
        if(result.ok){
          // Resume an approved-source render after a Railway restart, even
          // when the legacy MUSIC-led Shorts boot flag is disabled. The Short
          // always uses narration and burned-in captions.
          if(short||process.env[renderOnBoot]==='true')
            queueReviewedChristianDraft(format,'REVIEWED_BANK_BOOT_RECOVERY')
        }
      }catch(error){
        console.error('CHRISTIAN_PEXELS_FORMAT_STAGE_FAILED',JSON.stringify({
          format,error:String(error?.message||error),publishingAllowed:false
        }))
      }
    }
    void (async()=>{
      await stageFormat('SHORT_59','CHRISTIAN_PEXELS_RENDER_SHORT_ON_BOOT')
      if(process.env.CHRISTIAN_PEXELS_STAGE_LONG_ON_BOOT==='true')
        await stageFormat('YOUTUBE_LONG','CHRISTIAN_PEXELS_RENDER_LONG_ON_BOOT')
    })().catch(error=>console.error('CHRISTIAN_PEXELS_FORMAT_BOOT_FAILED',JSON.stringify({
      error:String(error?.message||error),publishingAllowed:false
    })))
  }
  if(process.env.CHRISTIAN_MUSIC_VIDEO_DRAFT_ON_BOOT==='true'){
    console.log('CHRISTIAN_MUSIC_VIDEO_BOOT_START',JSON.stringify({
      title:'Amazing Grace',publishingAllowed:false,creditsUsed:0
    }))
    void renderChristianMusicVideoDraft()
      .catch(error=>console.error('CHRISTIAN_MUSIC_VIDEO_BOOT_FAILED',JSON.stringify({
        error:String(error?.message||error),publishingAllowed:false
      })))
  }

})
