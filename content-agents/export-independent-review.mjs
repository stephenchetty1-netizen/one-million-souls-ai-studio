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
const sample=entries[0]
for(const [kind,url,expectedHash] of [['video',sample.videoUrl,sample.masterHash],['audio',sample.audioReviewUrl,sample.audioReviewHash]]){
 if(!/^[a-f0-9]{64}$/i.test(String(expectedHash||'')))throw new Error('MEDIA_EXPECTED_HASH_MISSING_'+kind)
 const response=await fetch(url,{signal:AbortSignal.timeout(90000),cache:'no-store'})
 if(!response.ok)throw new Error('MEDIA_ACCESS_HTTP_'+kind+'_'+response.status)
 const actual=crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')
 if(actual.toLowerCase()!==expectedHash.toLowerCase())throw new Error('MEDIA_HASH_MISMATCH_'+kind)
 console.log('INDEPENDENT_REVIEW_MEDIA_ACCESS_VERIFIED '+JSON.stringify({kind,date:sample.date,slot:sample.slot,sha256:actual}))
}
console.log('INDEPENDENT_REVIEW_MEDIA_INDEX '+JSON.stringify(entries.map(e=>({date:e.date,slot:e.slot,title:e.title,masterHash:e.masterHash,videoUrl:e.videoUrl,audioReviewUrl:e.audioReviewUrl,contactSheetUrl:e.contactSheetUrl}))))
