import crypto from 'node:crypto'
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3'
import {requireChristianVideoFormat} from './christian-video-formats.mjs'
import {christianVisualReviewReadiness} from './christian-visual-editorial-gate.mjs'

const ROOT='internal/pexels-source-candidates/v1'
const store=()=>new S3Client({endpoint:process.env.ENDPOINT,region:process.env.REGION,forcePathStyle:true,
 credentials:{accessKeyId:process.env.ACCESS_KEY_ID,secretAccessKey:process.env.SECRET_ACCESS_KEY}})
const collectionFor=format=>format==='SHORT_59'?'BE_STILL_PEXELS_V1':'YOUTUBE_WORSHIP_LANDSCAPE_V1'
const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
let reviewInProgress=false
function requireFormat(format){requireChristianVideoFormat(format);return collectionFor(format)}
async function inventory(s3,format){
 const collection=requireFormat(format)
 const key=`${ROOT}/${collection}/manifest.json`
 const response=await s3.send(new GetObjectCommand({Bucket:process.env.BUCKET,Key:key}))
 const manifest=JSON.parse(await response.Body.transformToString())
 if(manifest?.collection!==collection||manifest?.formatId!==format||!Array.isArray(manifest?.assets))
  throw new Error('EXACT_SOURCE_INVENTORY_UNAVAILABLE')
 return {collection,key,manifest}
}
function candidate(manifest,id,collection){
 const source=manifest.assets.find(x=>String(x?.id)===String(id))
 if(!source||!Number.isInteger(Number(id))||
   !String(source.sourceObjectKey||'').startsWith(`${ROOT}/${collection}/`)||
   !/^[a-f0-9]{64}$/i.test(String(source.videoSha256||'')))
  throw new Error('EXACT_REVIEW_SOURCE_NOT_FOUND')
 return source
}
export function validateHumanSourceReview(source,body){
 if(!source||String(body?.sourceVideoHash||'').toLowerCase()!==String(source.videoSha256||'').toLowerCase())
  throw new Error('EXACT_SOURCE_SHA256_REQUIRED')
 const decision=String(body?.decision||'')
 if(!['APPROVE','REJECT'].includes(decision))throw new Error('EXPLICIT_APPROVE_OR_REJECT_REQUIRED')
 if(body?.attestation!=='I_WATCHED_ENTIRE_EXACT_SOURCE_VIDEO')
  throw new Error('FULL_EXACT_SOURCE_WATCH_ATTESTATION_REQUIRED')
 const reviewer=String(body?.reviewer||'').trim().slice(0,100)
 if(reviewer.length<2)throw new Error('REVIEWER_NAME_REQUIRED')
 const notes=String(body?.notes||'').trim().slice(0,1800)
 if(notes.length<12)throw new Error('SPECIFIC_VISUAL_REVIEW_NOTES_REQUIRED')
 const bookInScene=body?.bookInScene===true
 const bookIsBibleVerified=body?.bookIsBibleVerified===true
 const conflicting=body?.hasConflictingReligiousTextOrRitual===true
 const christian=body?.christianScriptureOrPrayerVisualVerified===true
 if(decision==='APPROVE'&&(!christian||conflicting||(bookInScene&&!bookIsBibleVerified)))
  throw new Error('CHRISTIAN_SCENE_CONTENT_NOT_CONFIRMED')
 return {reviewer,notes,decision,bookInScene,bookIsBibleVerified,conflicting,christian}
}
export async function christianSourceReviewQueue(format='SHORT_59'){
 const {collection,manifest}=await inventory(store(),format)
 const reviewed=christianVisualReviewReadiness(manifest.assets)
 return {ok:true,format,collection,publishingAllowed:false,required:requireChristianVideoFormat(format).minimumDistinctClips,
  technicalSourcesReady:manifest.technicalSourceReady===true,reviewed:reviewed.reviewedClips,total:reviewed.totalClips,
  assets:manifest.assets.map(x=>({id:x.id,sourceVideoHash:x.videoSha256,
   pageUrl:x.pageUrl,creator:x.creator,sourceSlot:x.sourceSlot,intent:x.intent,
   width:x.width,height:x.height,durationSeconds:x.durationSeconds,
   reviewStatus:x.visualChristianEditorialStatus||'AWAITING_SOURCE_VISUAL_REVIEW',
   reviewedHash:x.visualReviewedVideoSha256||null,bookInScene:x.bookInScene??null,
   bookIsBibleVerified:x.bookIsBibleVerified??null,reviewNotes:x.visualReviewNotes||null}))}
}
export async function christianReviewSourceObject(format,id,range){
 const s3=store()
 const {collection,manifest}=await inventory(s3,format)
 const source=candidate(manifest,id,collection)
 if(range&&!/^bytes=\d{1,12}-\d{0,12}$/.test(range))
  throw new Error('INVALID_VIDEO_BYTE_RANGE')
 const result=await s3.send(new GetObjectCommand({Bucket:process.env.BUCKET,
  Key:source.sourceObjectKey,...(range?{Range:range}:{})}))
 return {result,hash:source.videoSha256}
}
export async function recordChristianSourceReview(format,body){
 if(reviewInProgress)throw new Error('REVIEW_WRITE_IN_PROGRESS')
 reviewInProgress=true
 try{
 const s3=store()
 const {collection,key,manifest}=await inventory(s3,format)
 const source=candidate(manifest,body?.id,collection)
 const review=validateHumanSourceReview(source,body)
 const object=await s3.send(new GetObjectCommand({Bucket:process.env.BUCKET,Key:source.sourceObjectKey}))
 if(Number(object.ContentLength||0)>180*1024*1024)throw new Error('EXACT_SOURCE_TOO_LARGE')
 const bytes=Buffer.from(await object.Body.transformToByteArray())
 if(bytes.length<100000||bytes.length>180*1024*1024||sha(bytes)!==source.videoSha256)
  throw new Error('EXACT_SOURCE_BYTES_CHANGED_REVIEW_INVALID')
 const at=new Date().toISOString()
 const approved=review.decision==='APPROVE'
 const updated={...source,
  visualChristianEditorialStatus:approved?'APPROVED_CHRISTIAN_STORY_FIT':'REJECTED_CHRISTIAN_STORY_FIT',
  visualReviewBasis:'HUMAN_FULL_SOURCE_WATCH',
  visualReviewedVideoSha256:source.videoSha256,
  christianScriptureOrPrayerVisualVerified:review.christian,
  bookInScene:review.bookInScene,bookIsBibleVerified:review.bookIsBibleVerified,
  hasConflictingReligiousTextOrRitual:review.conflicting,
  visualReviewNotes:review.notes,visualReviewer:review.reviewer,visualReviewedAt:at,
  reviewStatus:approved?'APPROVED_CHRISTIAN_STORY_FIT':'REJECTED_CHRISTIAN_STORY_FIT',
  publishingAllowed:false,professionalMasterCandidate:false}
 const revised={...manifest,assets:manifest.assets.map(x=>x.id===source.id?updated:x),
  generatedAt:at,publishingLocked:true,sourceBankReady:false}
 const readiness=christianVisualReviewReadiness(revised.assets)
 revised.christianVisualReviewedClips=readiness.reviewedClips
 revised.christianVisualEditorialReady=readiness.reviewedClips>=requireChristianVideoFormat(format).minimumDistinctClips
 revised.sourceBankReady=manifest.technicalSourceReady===true&&revised.christianVisualEditorialReady
 revised.status=revised.sourceBankReady?'SOURCE_REVIEW_COMPLETE':'AWAITING_SOURCE_VISUAL_REVIEW'
 revised.blockers=[...(manifest.blockers||[]).filter(x=>!String(x).startsWith('HUMAN_CHRISTIAN_SCENE_REVIEW_REQUIRED_'))]
 if(!revised.christianVisualEditorialReady)revised.blockers.push('HUMAN_CHRISTIAN_SCENE_REVIEW_REQUIRED_'+readiness.reviewedClips+'_OF_'+requireChristianVideoFormat(format).minimumDistinctClips)
 const auditKey=`internal/christian-visual-review/v1/${format}/${source.id}/${crypto.randomUUID()}.json`
 const put=async(k,data)=>s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:k,
  Body:JSON.stringify(data,null,2),ContentType:'application/json',CacheControl:'private, no-store'}))
 await put(auditKey,{format,id:source.id,sourceVideoHash:source.videoSha256,reviewer:review.reviewer,
  decision:review.decision,notes:review.notes,at,attestation:body.attestation,
  bookInScene:review.bookInScene,bookIsBibleVerified:review.bookIsBibleVerified,
  christianScriptureOrPrayerVisualVerified:review.christian,
  hasConflictingReligiousTextOrRitual:review.conflicting,publishingAllowed:false})
 await put(`${ROOT}/${collection}/${source.id}.json`,updated)
 await put(key,revised)
 console.log('CHRISTIAN_SOURCE_EXACT_VIDEO_REVIEW_RECORDED',JSON.stringify({
  format,id:source.id,decision:review.decision,reviewed:readiness.reviewedClips,
  required:requireChristianVideoFormat(format).minimumDistinctClips,publishingAllowed:false}))
 return {ok:true,format,id:source.id,decision:review.decision,reviewed:readiness.reviewedClips,
  required:requireChristianVideoFormat(format).minimumDistinctClips,sourceBankReady:revised.sourceBankReady,
  publishingAllowed:false}
 }finally{reviewInProgress=false}
}
