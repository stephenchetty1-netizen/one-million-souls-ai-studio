import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { durableRedis } from './durable-redis.mjs'

const rendererAddress=String(process.env.RAILWAY_SERVICE_ONE_MILLION_SOULS_VIDEO_RENDERER_URL||process.env.VIDEO_RENDER_WEBHOOK_URL||'').trim().replace(/\/$/,'')
const base=rendererAddress && !/^https?:\/\//i.test(rendererAddress)?'https://'+rendererAddress:rendererAddress
const secret=String(process.env.VIDEO_RENDER_SECRET||'')
const start=String(process.env.REVIEW_START_DATE||'')
const days=Math.min(14,Math.max(1,Number(process.env.REVIEW_DAYS||7)))
if(!base||!secret||!/^\d{4}-\d{2}-\d{2}$/.test(start))throw new Error('Set renderer URL, VIDEO_RENDER_SECRET, and REVIEW_START_DATE=YYYY-MM-DD')
const dateAt=n=>{const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const validHash=x=>/^[a-f0-9]{64}$/i.test(String(x||''))
const entries=[]
for(let i=0;i<days;i++){
 const date=dateAt(i)
 const response=await fetch(base+'/factory-manifest?date='+date,{headers:{authorization:'Bearer '+secret},cache:'no-store'})
 if(!response.ok)throw new Error('MANIFEST_'+date+'_HTTP_'+response.status)
 const manifest=await response.json()
 if(!Array.isArray(manifest.entries)||manifest.entries.length!==3)throw new Error('MANIFEST_'+date+'_EXPECTED_THREE_SLOTS')
 for(const entry of manifest.entries){
  if(!validHash(entry.contentHash)||!validHash(entry.masterHash)||entry.releasePayload?.masterHash!==entry.masterHash)throw new Error('INVALID_EXACT_MASTER_'+date+'_'+entry.slot)
  const assets=entry.reviewAssets||{}
  entries.push({
   date,slot:entry.slot,title:entry.title,contentHash:entry.contentHash,masterHash:entry.masterHash,
   script:entry.releasePayload?.script,scriptureReference:entry.releasePayload?.scriptureReference,
   videoUrl:entry.mediaUrl,thumbnailUrl:entry.thumbnailUrl,
   audioReviewUrl:assets.audioReviewUrl,audioReviewHash:assets.audioReviewHash,firstFrameUrl:assets.firstFrameUrl,
   contactSheetUrl:assets.contactSheetUrl,lastFrameUrl:assets.lastFrameUrl,
   measured:{renderQualityGate:entry.renderQualityGate,fullDecodeInspection:entry.fullDecodeInspection,masterInspection:entry.masterInspection,audioInspection:entry.audioInspection,captionInspection:entry.captionInspection},
   independentReview:{status:'PENDING',fullWatch:'PENDING',voiceAndMix:'PENDING',visualStory:'PENDING',scriptureAndScript:'PENDING',thumbnail:'PENDING',reviewer:null,reviewedAt:null,notes:null},
   approval:'LOCKED'
  })
 }
}
const packet={standard:'v59-independent-exact-master-v2',startDate:start,days,expected:days*3,total:entries.length,approved:0,publishingLocked:true,warning:'This is a review handoff, NOT a certificate. Review the complete exact video and audio before recording a decision.',entries}
const json=JSON.stringify(packet,null,2)+'\n'
const output=String(process.env.REVIEW_PACKET_PATH||'content-agents/independent-review-packet.json')
await fs.writeFile(output,json)
const redisKey='one-million-souls:v59:independent-review:'+start+':'+dateAt(days-1)
const persisted=await durableRedis(['SET',redisKey,json])
if(persisted!=='OK')throw new Error('REVIEW_PACKET_DURABLE_WRITE_FAILED')
if(await durableRedis(['GET',redisKey])!==json)throw new Error('REVIEW_PACKET_DURABLE_READ_MISMATCH')
console.log(JSON.stringify({ok:true,path:output,slots:entries.length,approved:0,redisKey,packetSha256:crypto.createHash('sha256').update(json).digest('hex')}))
const mediaChecks=[]
async function verifyMedia(entry,kind,url,expectedHash){
 const label=entry.date+'_'+entry.slot+'_'+kind
 if(!validHash(expectedHash))throw new Error('MEDIA_EXPECTED_HASH_MISSING_'+label)
 const parsed=new URL(String(url||''))
 if(parsed.origin!==new URL(base).origin || !parsed.pathname.startsWith('/media/'))throw new Error('MEDIA_URL_NOT_RENDERER_'+label)
 const response=await fetch(parsed.href,{signal:AbortSignal.timeout(120000),cache:'no-store'})
 if(!response.ok)throw new Error('MEDIA_ACCESS_HTTP_'+label+'_'+response.status)
 if(!response.body)throw new Error('MEDIA_EMPTY_BODY_'+label)
 const hash=crypto.createHash('sha256')
 let bytes=0
 for await(const chunk of response.body){hash.update(chunk);bytes+=chunk.length}
 if(!bytes)throw new Error('MEDIA_EMPTY_FILE_'+label)
 const actual=hash.digest('hex')
 if(actual.toLowerCase()!==expectedHash.toLowerCase())throw new Error('MEDIA_HASH_MISMATCH_'+label)
 const check={date:entry.date,slot:entry.slot,kind,sha256:actual,bytes}
 console.log('INDEPENDENT_REVIEW_MEDIA_ACCESS_VERIFIED '+JSON.stringify(check))
 return check
}
const failed=[]
for(let i=0;i<entries.length;i+=3){
 const batch=entries.slice(i,i+3)
 const outcomes=await Promise.all(batch.map(async entry=>{
  const result=[]
  for(const [kind,url,hash] of [['video',entry.videoUrl,entry.masterHash],['audio',entry.audioReviewUrl,entry.audioReviewHash]]){
   try{result.push(await verifyMedia(entry,kind,url,hash))}
   catch(error){failed.push({date:entry.date,slot:entry.slot,kind,error:String(error?.message||error)})}
  }
  return result
 }))
 for(const outcome of outcomes)mediaChecks.push(...outcome)
}
const verification={startDate:start,days,expected:entries.length*2,verified:mediaChecks.length,failed,publishingLocked:true,reviewStatus:'NOT_INDEPENDENTLY_APPROVED',at:new Date().toISOString()}
const verificationKey=redisKey+':media-integrity'
if(await durableRedis(['SET',verificationKey,JSON.stringify(verification)])!=='OK')throw new Error('MEDIA_INTEGRITY_RESULT_DURABLE_WRITE_FAILED')
console.log('INDEPENDENT_REVIEW_MEDIA_INTEGRITY_SUMMARY '+JSON.stringify(verification))
if(failed.length)throw new Error('INDEPENDENT_REVIEW_MEDIA_INTEGRITY_FAILED_'+failed.length)
console.log('INDEPENDENT_REVIEW_MEDIA_INDEX '+JSON.stringify(entries.map(e=>({date:e.date,slot:e.slot,title:e.title,masterHash:e.masterHash,videoUrl:e.videoUrl,audioReviewUrl:e.audioReviewUrl,contactSheetUrl:e.contactSheetUrl}))))
