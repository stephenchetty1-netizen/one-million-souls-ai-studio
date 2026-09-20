import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3'
const execFileAsync=promisify(execFile)
import {PEXELS_COLLECTIONS,validatePexelsMetadata,validatedPexelsVideoUrl} from './pexels-source-import.mjs'
import {CHRISTIAN_VIDEO_FORMATS,requireChristianVideoFormat,inspectChristianVideoSources} from './christian-video-formats.mjs'
import {christianVisualReviewReadiness} from './christian-visual-editorial-gate.mjs'

const ROOT='internal/pexels-source-candidates/v1'
const MAX_BYTES=95*1024*1024
const REQUEST_TIMEOUT=22000
const VIDEO_TIMEOUT=140000
// Search terms discover candidates; they NEVER establish Christian story fit.
// Avoid generic prayer gestures, generic books, or unrelated faith imagery.
// The full exact MP4 still needs explicit Christian human editorial approval.
export const CHRISTIAN_PEXELS_STORY=Object.freeze({
 SHORT_59:Object.freeze({
   collection:'BE_STILL_PEXELS_V1',orientation:'portrait',
   base:PEXELS_COLLECTIONS.BE_STILL_PEXELS_V1.map(x=>x.id),
   searches:Object.freeze([
     {query:'holy bible gospel readable pages',intent:'Verify Bible text and devotional focus'},
     {query:'church cross altar',intent:'Christian altar cross establishes unmistakable setting'},
     {query:'jesus christ church crucifix',intent:'Clearly Christian cross or Christ-centred imagery'},
     {query:'christian church worship cross',intent:'Christian worship with visible Christian context'},
     {query:'bible reading church cross',intent:'Bible reading with corroborating Christian context'},
     {query:'church stained glass crucifix',intent:'Recognizable Christian sacred setting'},
   ]),
 }),
 YOUTUBE_LONG:Object.freeze({
   collection:'YOUTUBE_WORSHIP_LANDSCAPE_V1',orientation:'landscape',base:[],
   searches:Object.freeze([
     {query:'church altar cross',intent:'Christian altar with visible cross',count:2},
     {query:'holy bible gospel pages',intent:'Verified New Testament or Bible close-up',count:2},
     {query:'jesus cross church interior',intent:'Christ-centred architecture and symbols',count:2},
     {query:'church stained glass crucifix',intent:'Visible Christian stained-glass subject',count:2},
     {query:'holy bible turning pages',intent:'Bible scripture visually confirmed, not a generic religious book',count:2},
     {query:'christian worship visible cross',intent:'Worship context with explicitly Christian signs',count:2},
     {query:'church steeple cross',intent:'Christian church architecture',count:2},
     {query:'chapel altar cross',intent:'Cross-centred Christian chapel',count:2},
     {query:'holy bible candle cross',intent:'Christian prayer still life, not an unverified ritual',count:2},
     {query:'jesus crucifix stained glass',intent:'Christian iconography',count:2},
     {query:'cross scripture church',intent:'Scripture and cross together',count:2},
     {query:'bible cross devotional',intent:'Christian devotional close-up',count:2},
   ]),
 }),
})
// Only use explicit source-description and page-slug clues to avoid known
// conflicting religions. Never infer the depicted person's faith from a cap,
// orange clothing, skin tone, name, ethnicity, or appearance.
const OTHER_FAITH_SOURCE_TERMS=/(?:^|[\s_\/-])(qur'?an|koran|quran|mosque|islamic|muslim|ramadan|hinduism|hindu|mandir|puja|veda|buddhist|buddha|prayer[\s_-]mat)(?=$|[\s_\/-])/i
export function conflictingFaithSourceMetadata(video){
  const sourceText=[video?.url,video?.title,video?.description]
    .filter(x=>typeof x==='string').join(' ')
  return OTHER_FAITH_SOURCE_TERMS.test(sourceText)
}

export function requireFormatPlan(format){
 const profile=requireChristianVideoFormat(format)
 const plan=CHRISTIAN_PEXELS_STORY[format]
 if(!plan||plan.orientation!==profile.orientation)
   throw new Error('PEXELS_FORMAT_PLAN_NOT_CURATED')
 return {profile,plan}
}
export function selectPexelsRendition(video,format){
 const {profile}=requireFormatPlan(format)
 if(!video||!Array.isArray(video.video_files))throw new Error('PEXELS_VIDEO_FILES_MISSING')
 const options=video.video_files.filter(f=>
   f?.file_type==='video/mp4'&&f.quality==='hd'&&
   Number(f.width)>=profile.width&&Number(f.height)>=profile.height&&
   (profile.orientation==='portrait'?Number(f.height)>Number(f.width):Number(f.width)>Number(f.height))&&
   (f.fps==null||Number(f.fps)>=24))
   .sort((a,b)=>Number(a.width)*Number(a.height)-Number(b.width)*Number(b.height))
 for(const file of options){
   try{return {...file,verifiedUrl:validatedPexelsVideoUrl(file.link)}}catch{}
 }
 throw new Error('PEXELS_NATIVE_'+profile.orientation.toUpperCase()+'_RENDITION_REQUIRED')
}
export function searchSlots(format){
 const {plan,profile}=requireFormatPlan(format)
 const count=plan.searches.reduce((total,x)=>total+(x.count||1),0)
 if(count+plan.base.length!==profile.minimumDistinctClips)
   throw new Error('PEXELS_CURATED_SHOT_PLAN_MISMATCH')
 return plan.searches.flatMap(x=>
   Array.from({length:x.count||1},(_,i)=>({
     id:x.query+':'+i,query:x.query,intent:x.intent,rank:i
   })))
}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex')
export function validateMeasuredPexelsVideo({streams,format:container},formatId){
 const {profile}=requireFormatPlan(formatId)
 const video=streams?.find(x=>x.codec_type==='video')
 const width=Number(video?.width),height=Number(video?.height)
 const durationSeconds=Number(container?.duration)
 const portrait=profile.orientation==='portrait'
 if(!Number.isFinite(width)||!Number.isFinite(height)||
    width<profile.width||height<profile.height||
    (portrait?height<=width:width<=height)||
    !Number.isFinite(durationSeconds)||
    durationSeconds<profile.secondsPerScene+0.35)
   throw new Error('PEXELS_MP4_MEASURED_PROFILE_MISMATCH: '+
     JSON.stringify({formatId,measuredWidth:width,measuredHeight:height,
       measuredDurationSeconds:durationSeconds,
       requiredWidth:profile.width,requiredHeight:profile.height,
       requiredDurationSeconds:profile.secondsPerScene+0.35}))
 return {width,height,durationSeconds}
}
async function probeRealPexelsVideo(bytes,formatId){
 const file=path.join(os.tmpdir(),'oms-pexels-probe-'+crypto.randomUUID()+'.mp4')
 try{
  await fs.writeFile(file,bytes)
  const {stdout}=await execFileAsync('ffprobe',['-v','error','-show_entries',
    'format=duration:stream=codec_type,codec_name,pix_fmt,width,height','-of','json',file],
    {timeout:35000,maxBuffer:2*1024*1024})
  const probe=JSON.parse(stdout)
  const measured=validateMeasuredPexelsVideo(probe,formatId)
  // A valid MP4 container does not imply an Android-browser-playable source.
  // Quarantine unsupported codecs before presenting a blank review player.
  const video=probe.streams?.find(x=>x.codec_type==='video')
  if(video?.codec_name!=='h264'||!['yuv420p','yuvj420p'].includes(video?.pix_fmt))
    throw new Error('PEXELS_SOURCE_BROWSER_CODEC_UNSUPPORTED')
  // Verify that FFmpeg can decode actual frames, not just read metadata.
  await execFileAsync('ffmpeg',['-v','error','-i',file,'-vf','fps=1/4,scale=32:32',
    '-frames:v','3','-f','null','-'],{timeout:45000,maxBuffer:2*1024*1024})
  // Inspect the actual opening story beat for black/blank footage. A technically
  // decodable clip can still display a black screen in the review player.
  // A full-scene black interval is rejected; short fades are permitted.
  const sceneSeconds=requireFormatPlan(formatId).profile.secondsPerScene
  const {stderr:blackLog}=await execFileAsync('ffmpeg',[
    '-hide_banner','-nostats','-i',file,'-t',String(sceneSeconds),
    '-vf','blackdetect=d=1:pix_th=0.10:pic_th=0.98',
    '-an','-f','null','-'
  ],{timeout:45000,maxBuffer:2*1024*1024})
  for(const match of blackLog.matchAll(/black_start:([\\d.]+)\\s+black_end:([\\d.]+)\\s+black_duration:([\\d.]+)/g)){
    if(Number(match[3])>=sceneSeconds*0.8)
      throw new Error('PEXELS_SOURCE_BLANK_OPENING_SCENE')
  }
  return measured
 }finally{await fs.rm(file,{force:true}).catch(()=>{})}
}

function s3(){
 if(!process.env.ENDPOINT||!process.env.BUCKET||!process.env.REGION||
   !process.env.ACCESS_KEY_ID||!process.env.SECRET_ACCESS_KEY)
   throw new Error('PEXELS_FORMAT_PRIVATE_STORAGE_REQUIRED')
 return new S3Client({endpoint:process.env.ENDPOINT,region:process.env.REGION,forcePathStyle:true,
   credentials:{accessKeyId:process.env.ACCESS_KEY_ID,secretAccessKey:process.env.SECRET_ACCESS_KEY}})
}
async function readJson(store,key){
 try{
  const result=await store.send(new GetObjectCommand({Bucket:process.env.BUCKET,Key:key}))
  return JSON.parse(await result.Body.transformToString())
 }catch(e){
  if(!['NoSuchKey','NotFound'].includes(e?.name||''))console.warn('PEXELS_FORMAT_MANIFEST_MISS',JSON.stringify({reason:e?.name||'unavailable'}))
  return null
 }
}
async function searchPexels(query,orientation){
 const url=new URL('https://api.pexels.com/v1/videos/search')
 url.searchParams.set('query',query)
 url.searchParams.set('orientation',orientation)
 url.searchParams.set('size','medium')
 url.searchParams.set('per_page','40')
 const response=await fetch(url,{
   headers:{Authorization:String(process.env.PEXELS_API_KEY||''),Accept:'application/json'},
   signal:AbortSignal.timeout(REQUEST_TIMEOUT)
 })
 if(response.status===429)throw new Error('PEXELS_SEARCH_API_QUOTA_EXHAUSTED')
 if(!response.ok)throw new Error('PEXELS_SEARCH_HTTP_'+response.status)
 const json=await response.json()
 return Array.isArray(json.videos)?json.videos:[]
}
async function getVideo(url){
 const response=await fetch(validatedPexelsVideoUrl(url),{signal:AbortSignal.timeout(VIDEO_TIMEOUT),
   headers:{Accept:'video/mp4'}})
 if(!response.ok)throw new Error('PEXELS_FORMAT_DOWNLOAD_HTTP_'+response.status)
 validatedPexelsVideoUrl(response.url)
 const length=Number(response.headers.get('content-length')||0)
 if(length>MAX_BYTES)throw new Error('PEXELS_FORMAT_VIDEO_EXCEEDS_BUDGET')
 const type=String(response.headers.get('content-type')||'').toLowerCase()
 if(type&&!type.includes('video/')&&!type.includes('octet-stream'))
   throw new Error('PEXELS_FORMAT_UNEXPECTED_CONTENT_TYPE')
 const parts=[]
 let size=0
 for await(const part of response.body){
   size+=part.length
   if(size>MAX_BYTES)throw new Error('PEXELS_FORMAT_VIDEO_EXCEEDS_BUDGET')
   parts.push(Buffer.from(part))
 }
 if(size<100000)throw new Error('PEXELS_FORMAT_VIDEO_EMPTY')
 return Buffer.concat(parts,size)
}
let active=null
export async function stageChristianPexelsFormat(format='SHORT_59'){
 const {plan,profile}=requireFormatPlan(format)
 if(!process.env.PEXELS_API_KEY)throw new Error('PEXELS_API_KEY_REQUIRED')
 if(active)throw new Error('PEXELS_FORMAT_STAGE_ALREADY_RUNNING')
 active=(async()=>{
 const store=s3()
 const manifestKey=`${ROOT}/${plan.collection}/manifest.json`
 const old=await readJson(store,manifestKey)
 const existing=Array.isArray(old?.assets)?old.assets:[]
 const assets=[]
 const used=new Set(existing.map(x=>Number(x?.id)).filter(Number.isInteger))
 const invalidSources=[]
 // Check real media, not merely the Pexels API duration and resolution.
 for(const source of existing){
   // Human-rejected imagery is never recycled by staging or cache reuse.
   if(source?.visualChristianEditorialStatus==='REJECTED_CHRISTIAN_STORY_FIT'||
      source?.reviewStatus==='REJECTED_CHRISTIAN_STORY_FIT'){
     invalidSources.push({id:source?.id,sourceSlot:source?.sourceSlot||null,
       reason:'HUMAN_REJECTED_VISUAL_SOURCE'})
     console.warn('PEXELS_REJECTED_SOURCE_QUARANTINED',JSON.stringify({
       format,id:source?.id,publishingAllowed:false}))
     continue
   }
   try{
     const object=await store.send(new GetObjectCommand({
       Bucket:process.env.BUCKET,Key:source.sourceObjectKey}))
     if(Number(object.ContentLength||0)>MAX_BYTES)
       throw new Error('PEXELS_CACHED_VIDEO_TOO_LARGE')
     const bytes=Buffer.from(await object.Body.transformToByteArray())
     if(bytes.length<100000||bytes.length>MAX_BYTES||hash(bytes)!==source.videoSha256)
       throw new Error('PEXELS_CACHED_VIDEO_HASH_OR_SIZE_INVALID')
     const measured=await probeRealPexelsVideo(bytes,format)
     assets.push({...source,...measured})
   }catch(error){
     invalidSources.push({id:source?.id,sourceSlot:source?.sourceSlot||null,
       reason:String(error?.message||error).slice(0,380)})
     console.warn('PEXELS_CACHED_SOURCE_QUARANTINED',JSON.stringify({
       format,id:source?.id,sourceSlot:source?.sourceSlot||null,
       reason:String(error?.message||error).slice(0,380),
       publishingAllowed:false
     }))
   }
 }
 // An invalid or rejected original short clip must be replaceable; never
 // demand that a previously rejected base ID re-enter the source bank.
 const missingBase=format==='SHORT_59'
   ?plan.base.filter(id=>!assets.some(x=>Number(x?.id)===id))
   :[]
 const failures=[]
 let staged=0
 const slots=[...searchSlots(format),...missingBase.map((id,index)=>({
   id:'replacement-base:'+id,query:[
     'church altar cross','holy bible gospel pages','christian worship visible cross'
   ][index%3],intent:'Replace rejected source with a new distinctly reviewed Christian video',rank:0
 }))]
 const searches=new Map()
 for(const slot of slots){
   if(assets.some(x=>x.sourceSlot===slot.id))continue
   if(assets.length>=profile.minimumDistinctClips)break
   try{
     if(!searches.has(slot.query))
       searches.set(slot.query,await searchPexels(slot.query,plan.orientation))
     const results=searches.get(slot.query)
     let added=false
     for(const candidate of results){
       const id=Number(candidate?.id)
       if(!Number.isInteger(id)||used.has(id)||conflictingFaithSourceMetadata(candidate)||Number(candidate?.duration||0)<profile.secondsPerScene+0.6)continue
       let file,pageUrl
       try{
         file=selectPexelsRendition(candidate,format)
         pageUrl=validatePexelsMetadata(candidate,id)
       }catch{continue}
       try{
         const b=await getVideo(file.verifiedUrl)
         const measured=await probeRealPexelsVideo(b,format)
         const sourceObjectKey=`${ROOT}/${plan.collection}/${id}-${file.id}.mp4`
         const metadataKey=`${ROOT}/${plan.collection}/${id}.json`
         const metadata={
           id,beat:'WORSHIP',intent:slot.intent,sourceSlot:slot.id,searchQuery:slot.query,
           pageUrl,creator:String(candidate.user.name),creatorUrl:String(candidate.user.url||''),
           attribution:'Video by '+String(candidate.user.name)+' via Pexels',
           pexelsLink:'https://www.pexels.com/',license:'Pexels License',
           licenseUrl:'https://www.pexels.com/legal-pages/license/',
           copyrightAndReleases:'SUBJECT_TO_INDEPENDENT_RIGHTS_AND_MODEL_REVIEW',
           width:measured.width,height:measured.height,
           fps:Number(file.fps||0),durationSeconds:measured.durationSeconds,
           videoSha256:hash(b),videoBytes:b.length,sourceObjectKey,
           sourceIsPrivate:true,reviewStatus:'AWAITING_SOURCE_VISUAL_REVIEW',
           editorialContinuity:'NOT_YET_VERIFIED',
           professionalMasterCandidate:false,publishingAllowed:false,
           importedAt:new Date().toISOString(),
         }
         await store.send(new PutObjectCommand({Bucket:process.env.BUCKET,
           Key:sourceObjectKey,Body:b,ContentType:'video/mp4',
           CacheControl:'private, max-age=31536000, immutable'}))
         await store.send(new PutObjectCommand({Bucket:process.env.BUCKET,
           Key:metadataKey,Body:JSON.stringify(metadata,null,2),
           ContentType:'application/json',CacheControl:'private, no-store'}))
         assets.push(metadata)
         used.add(id)
         staged++
         added=true
         console.log('PEXELS_FORMAT_SOURCE_STAGED',JSON.stringify({
           format,id,sourceSlot:slot.id,width:metadata.width,height:metadata.height,
           sourceSha256:metadata.videoSha256,publishingAllowed:false
         }))
         break
       }catch(error){
         console.warn('PEXELS_FORMAT_SOURCE_SKIPPED',JSON.stringify({
           format,sourceSlot:slot.id,id,reason:String(error?.message||error).slice(0,180)
         }))
       }
     }
     if(!added)failures.push({sourceSlot:slot.id,reason:'NO_ELIGIBLE_NATIVE_SOURCE_FOR_STORY_BEAT'})
   }catch(error){
     failures.push({sourceSlot:slot.id,reason:String(error?.message||error).slice(0,180)})
     if(/QUOTA_EXHAUSTED/.test(String(error?.message||error)))break
   }
 }
 const result=inspectChristianVideoSources(format,assets,Infinity)
 const editorial=christianVisualReviewReadiness(assets)
 const ready=result.readyForDraftRender&&
   editorial.reviewedClips>=profile.minimumDistinctClips
 const blockers=[...result.blockers]
 if(editorial.reviewedClips<profile.minimumDistinctClips)
   blockers.push('HUMAN_CHRISTIAN_SCENE_REVIEW_REQUIRED_'+
     editorial.reviewedClips+'_OF_'+profile.minimumDistinctClips)
 const manifest={
   collection:plan.collection,formatId:format,provider:'Pexels',
   pexelsLink:'https://www.pexels.com/',license:'Pexels License',
   sourceClips:assets.length,status:'AWAITING_SOURCE_VISUAL_REVIEW',
   sourceBankReady:ready,technicalSourceReady:result.readyForDraftRender,
   christianVisualEditorialReady:editorial.reviewedClips>=profile.minimumDistinctClips,
   christianVisualReviewedClips:editorial.reviewedClips,blockers,
   failures,invalidSources,publishingLocked:true,noPaidGenerationCredits:true,
   assets,generatedAt:new Date().toISOString()
 }
 await store.send(new PutObjectCommand({Bucket:process.env.BUCKET,
   Key:manifestKey,Body:JSON.stringify(manifest,null,2),
   ContentType:'application/json',CacheControl:'private, no-store'}))
 console.log('PEXELS_FORMAT_STAGE_RESULT',JSON.stringify({
   format,collection:plan.collection,sourceClips:assets.length,
   required:profile.minimumDistinctClips,staged,ready,
   technicalSourceReady:result.readyForDraftRender,
   christianVisualReviewedClips:editorial.reviewedClips,
   blockers,failures,invalidSources,publishingAllowed:false
 }))
 return {ok:ready,format,collection:plan.collection,
   sourceClips:assets.length,required:profile.minimumDistinctClips,
   technicalSourceReady:result.readyForDraftRender,
   christianVisualReviewedClips:editorial.reviewedClips,
   staged,blockers,failures,invalidSources,publishingAllowed:false}
 })()
 try{return await active}finally{active=null}
}
