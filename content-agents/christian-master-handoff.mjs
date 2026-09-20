import crypto from 'node:crypto'

// This is a review handoff, NEVER a certificate or a publishing adapter.
// Inspect both Christian media formats independently from the disabled legacy factory.
const FORMATS = Object.freeze({
  SHORT_59: {path:'/christian-reviewed-draft-latest', mediaPrefix:'/media/narrated-short-review-v1/', count:9},
  YOUTUBE_LONG: {path:'/christian-reviewed-long-draft-latest', mediaPrefix:'/media/music-video-review-v1/YOUTUBE_LONG/', count:24},
})
const HASH=/^[a-f0-9]{64}$/i
const MAX_BYTES=400*1024*1024
function status(format,name,extra={}){
 return {format,status:name,certified:false,publishingLocked:true,
   publicationPermissionGranted:false,checkedAt:new Date().toISOString(),...extra}
}
async function requestJson(fetchImpl,url,secret){
 const r=await fetchImpl(url,{headers:{authorization:'Bearer '+secret},cache:'no-store',
   signal:AbortSignal.timeout(30000)})
 if(r.status===404)return {missing:true}
 if(!r.ok)throw new Error('REVIEW_ENDPOINT_HTTP_'+r.status)
 return {value:await r.json()}
}
async function digestMedia(fetchImpl,url,secret,minBytes){
 const r=await fetchImpl(url,{headers:{authorization:'Bearer '+secret},cache:'no-store',
   signal:AbortSignal.timeout(180000)})
 if(!r.ok||!r.body)throw new Error('MASTER_ASSET_HTTP_'+r.status)
 let size=0
 const h=crypto.createHash('sha256')
 for await(const part of r.body){
  size+=part.length
  if(size>MAX_BYTES)throw new Error('MASTER_ASSET_OVERSIZE')
  h.update(part)
 }
 if(size<minBytes)throw new Error('MASTER_ASSET_UNDERSIZE')
 return {sha256:h.digest('hex'),bytes:size}
}
export async function inspectChristianHandoff(format,{base,secret,fetchImpl=fetch}={}){
 const plan=FORMATS[format]
 if(!plan)throw new Error('UNSUPPORTED_CHRISTIAN_FORMAT')
 if(!base||!secret)return status(format,'RENDERER_OR_AUTH_NOT_CONFIGURED')
 const origin=new URL(base).origin
 let q
 try{q=(await requestJson(fetchImpl,origin+'/christian-review-queue?format='+format,secret)).value}
 catch(error){return status(format,'SOURCE_QUEUE_UNAVAILABLE',{reason:String(error.message).slice(0,200)})}
 const clips=Array.isArray(q?.assets)?q.assets:[]
 const reviewed=clips.filter(x=>x.reviewStatus==='APPROVED_CHRISTIAN_STORY_FIT' &&
   HASH.test(String(x.sourceVideoHash||'')) &&
   String(x.reviewedHash||'').toLowerCase()===String(x.sourceVideoHash||'').toLowerCase())
 if(!q?.ok||q.required!==plan.count||clips.length<plan.count||
    reviewed.length!==plan.count||q.reviewed!==plan.count||q.technicalSourcesReady!==true){
   return status(format,'AWAITING_HUMAN_EXACT_SOURCE_REVIEW',{
     required:plan.count,approved:reviewed.length,total:clips.length,
     technicallyReady:q?.technicalSourcesReady===true,
     remaining:Math.max(0,plan.count-reviewed.length)})
 }
 let draft
 try{draft=(await requestJson(fetchImpl,origin+plan.path,secret)).value}
 catch(error){return status(format,'REVIEWED_DRAFT_LOOKUP_FAILED',{reason:String(error.message).slice(0,200)})}
 if(!draft)return status(format,'AWAITING_REVIEWED_SOURCE_RENDER',{
  required:plan.count,approved:reviewed.length})
 const expected=String(draft.masterHash||'').toLowerCase()
 let url,contact
 try{url=new URL(draft.mediaUrl);contact=new URL(draft.contactSheetUrl)}
 catch{return status(format,'REVIEWED_MASTER_URL_INVALID')}
 const dimensions=format==='SHORT_59'?[1080,1920,59]:[1920,1080,240]
 const measured=draft.measured||{}
 const mediaProfileValid=measured.fullDecodePassed===true &&
   Number(measured.width)===dimensions[0] &&
   Number(measured.height)===dimensions[1] &&
   Number(measured.fps)>=29.9 &&
   Math.abs(Number(measured.durationSeconds)-dimensions[2])<=0.35
 if(!draft.ok||!mediaProfileValid||draft.sourceClips!==plan.count||draft.voiceover!==true||
    draft.captionsPresent!==true||draft.certification!=='NOT_CERTIFIED'||
    draft.masterReady!==false||draft.publishingAllowed!==false||
    !HASH.test(expected)||!HASH.test(String(draft.contactSheetHash||''))||url.origin!==origin||contact.origin!==origin||
    !url.pathname.startsWith(plan.mediaPrefix)||
    !contact.pathname.startsWith(plan.mediaPrefix)||
    !url.pathname.endsWith('.mp4')||!contact.pathname.endsWith('.jpg'))
  return status(format,'REVIEWED_MASTER_IDENTITY_INVALID')
 let media,sheet
 try{
  media=await digestMedia(fetchImpl,url.href,secret,1000000)
  sheet=await digestMedia(fetchImpl,contact.href,secret,10000)
 }catch(error){return status(format,'MASTER_MEDIA_UNAVAILABLE',{
   reason:String(error.message).slice(0,200),masterHash:expected})}
 if(media.sha256!==expected||
    sheet.sha256!==String(draft.contactSheetHash).toLowerCase())
  return status(format,'EXACT_MASTER_MEDIA_HASH_MISMATCH',{
   masterHash:expected,measuredHash:media.sha256})
 return status(format,'AWAITING_INDEPENDENT_FINAL_MASTER_REVIEW',{
  masterHash:expected,title:draft.title,id:draft.id,
  mediaUrl:url.href,contactSheetUrl:contact.href,
  fullMasterBytes:media.bytes,contactSheetHash:sheet.sha256,
  exactMp4Verified:true,approvedSourceClips:plan.count,
  narrationAndCaptionsReported:true,
  finalHumanAudiovisualReview:'PENDING',rightsReview:'PENDING',
  durable50AgentCertificate:'NOT_PRESENT',releaseStatus:'NOT_CERTIFIED'})
}
export async function scanChristianHandoffs({base,secret,fetchImpl=fetch,persist=async()=>{}}={}){
 const reports=[]
 for(const format of Object.keys(FORMATS)){
  let report
  try{report=await inspectChristianHandoff(format,{base,secret,fetchImpl})}
  catch(e){report=status(format,'CHRISTIAN_HANDOFF_SCAN_FAILED',{
   reason:String(e?.message||e).slice(0,200)})}
  const key='one-million-souls:v59:christian-master-handoff:'+format
  await persist(key,JSON.stringify(report))
  reports.push(report)
 }
 return {standard:'v59-two-format-exact-source-review-handoff-v1',reports,
  allCertified:false,publishingLocked:true}
}
