import crypto from 'node:crypto'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

// Candidate footage, not approved final-master footage. All three Pexels pages
// share the contributor Tima Miroshnichenko and have devotional subject matter.
export const PEXELS_COLLECTIONS=Object.freeze({
  'BE_STILL_PEXELS_V1':Object.freeze([
    {id:5206028,beat:'TENSION',intent:'Person stops striving and sits in quiet prayer'},
    {id:5206029,beat:'SCRIPTURE',intent:'Bible study and page turn in the same home environment'},
    {id:5206032,beat:'RESPONSE',intent:'Personal prayer at a Bible, not unrelated scenic filler'},
  ]),
})
const STORAGE_PREFIX='internal/pexels-source-candidates/v1'
const MAX_VIDEO_BYTES=180*1024*1024
const ALLOWED_VIDEO_HOSTS=new Set([
  'videos.pexels.com','video.pexels.com','player.vimeo.com',
])
const token=()=>String(process.env.PEXELS_API_KEY||'').trim()
const storageReady=()=>Boolean(process.env.ENDPOINT&&process.env.BUCKET&&process.env.REGION&&process.env.ACCESS_KEY_ID&&process.env.SECRET_ACCESS_KEY)
const s3Client=()=>new S3Client({
  endpoint:process.env.ENDPOINT,region:process.env.REGION,forcePathStyle:true,
  credentials:{accessKeyId:process.env.ACCESS_KEY_ID,secretAccessKey:process.env.SECRET_ACCESS_KEY},
})
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
export function validatedPexelsVideoUrl(link){
  const parsed=new URL(String(link||''))
  if(parsed.protocol!=='https:'||!ALLOWED_VIDEO_HOSTS.has(parsed.hostname))
    throw new Error('PEXELS_VIDEO_SOURCE_DOMAIN_NOT_ALLOWED')
  return parsed.href
}
export function choosePortraitMp4(video){
  const files=(Array.isArray(video?.video_files)?video.video_files:[])
    .filter(f=>f?.file_type==='video/mp4'&&f?.quality==='hd'&&
      Number(f.width)>=1080&&Number(f.height)>=1920&&
      Number(f.height)>Number(f.width)&&
      (f.fps==null||Number(f.fps)>=24))
    .map(f=>({...f,verifiedUrl:validatedPexelsVideoUrl(f.link)}))
    .sort((a,b)=>Number(b.width)*Number(b.height)-Number(a.width)*Number(a.height))
  if(!files.length)throw new Error('PEXELS_NO_NATIVE_1080X1920_PORTRAIT_MP4')
  return files[0]
}
export function validatePexelsMetadata(video,id){
  if(Number(video?.id)!==id)throw new Error('PEXELS_VIDEO_ID_MISMATCH')
  const page=new URL(String(video?.url||''))
  if(page.protocol!=='https:'||page.hostname!=='www.pexels.com'||
     !/^\/video\//.test(page.pathname)||!page.pathname.includes(String(id)))
    throw new Error('PEXELS_SOURCE_PAGE_INVALID')
  if(!String(video?.user?.name||'').trim())throw new Error('PEXELS_CREATOR_UNKNOWN')
  return page.href
}
async function getJsonFromPexels(id){
  const response=await fetch('https://api.pexels.com/v1/videos/videos/'+id,{
    headers:{Authorization:token(),Accept:'application/json'},
    signal:AbortSignal.timeout(25000),
  })
  if(response.status===429)throw new Error('PEXELS_API_QUOTA_EXHAUSTED')
  if(!response.ok)throw new Error('PEXELS_API_HTTP_'+response.status)
  return response.json()
}
async function fetchBoundedVideo(url){
  const response=await fetch(validatedPexelsVideoUrl(url),{
    signal:AbortSignal.timeout(180000),
    headers:{Accept:'video/mp4'},
  })
  if(!response.ok)throw new Error('PEXELS_VIDEO_DOWNLOAD_HTTP_'+response.status)
  const type=String(response.headers.get('content-type')||'').toLowerCase()
  if(type&&!type.includes('video/')&&!type.includes('application/octet-stream'))
    throw new Error('PEXELS_VIDEO_UNEXPECTED_CONTENT_TYPE')
  const length=Number(response.headers.get('content-length')||0)
  if(length>MAX_VIDEO_BYTES)throw new Error('PEXELS_VIDEO_TOO_LARGE')
  if(!response.body)throw new Error('PEXELS_VIDEO_EMPTY_BODY')
  const chunks=[]
  let size=0
  for await(const part of response.body){
    size+=part.length
    if(size>MAX_VIDEO_BYTES)throw new Error('PEXELS_VIDEO_TOO_LARGE')
    chunks.push(Buffer.from(part))
  }
  if(size<100000)throw new Error('PEXELS_VIDEO_TOO_SMALL')
  return Buffer.concat(chunks,size)
}
async function getCachedMetadata(s3,key){
  try{
    const r=await s3.send(new GetObjectCommand({Bucket:process.env.BUCKET,Key:key}))
    const json=JSON.parse(await r.Body.transformToString())
    if(json?.reviewStatus==='AWAITING_SOURCE_VISUAL_REVIEW'&&json?.videoSha256&&json?.sourceObjectKey)return json
  }catch(e){
    // Missing metadata or invalid prior metadata means run authorized import.
    if(e?.name&& !['NoSuchKey','NotFound'].includes(e.name))
      console.warn('PEXELS_METADATA_CACHE_MISS',JSON.stringify({reason:e.name}))
  }
  return null
}
let activeImport=null
export async function stagePexelsCollection(collection='BE_STILL_PEXELS_V1'){
  if(!Object.hasOwn(PEXELS_COLLECTIONS,collection))throw new Error('PEXELS_COLLECTION_NOT_APPROVED_FOR_STAGING')
  if(!token())throw new Error('PEXELS_API_KEY_REQUIRED')
  if(!storageReady())throw new Error('PEXELS_PRIVATE_STORAGE_REQUIRED')
  if(activeImport)throw new Error('PEXELS_IMPORT_ALREADY_IN_PROGRESS')
  activeImport=(async()=>{
    const s3=s3Client()
    const entries=[]
    for(const shot of PEXELS_COLLECTIONS[collection]){
      const metadataKey=`${STORAGE_PREFIX}/${collection}/${shot.id}.json`
      const cached=await getCachedMetadata(s3,metadataKey)
      if(cached){entries.push(cached);continue}
      const video=await getJsonFromPexels(shot.id)
      const pageUrl=validatePexelsMetadata(video,shot.id)
      const file=choosePortraitMp4(video)
      const bytes=await fetchBoundedVideo(file.verifiedUrl)
      const objectKey=`${STORAGE_PREFIX}/${collection}/${shot.id}-${file.id}.mp4`
      const metadata={
        id:shot.id,beat:shot.beat,intent:shot.intent,
        pageUrl,creator:String(video.user.name),creatorUrl:String(video.user.url||''),
        attribution:'Video by '+String(video.user.name)+' via Pexels',
        pexelsLink:'https://www.pexels.com/',
        license:'Pexels License',licenseUrl:'https://www.pexels.com/legal-pages/license/',
        copyrightAndReleases:'SUBJECT_TO_INDEPENDENT_RIGHTS_AND_MODEL_REVIEW',
        width:Number(file.width),height:Number(file.height),
        fps:Number(file.fps||0),durationSeconds:Number(video.duration||0),
        videoSha256:sha256(bytes),videoBytes:bytes.length,sourceObjectKey:objectKey,
        sourceIsPrivate:true,reviewStatus:'AWAITING_SOURCE_VISUAL_REVIEW',
        editorialContinuity:'NOT_YET_VERIFIED',
        professionalMasterCandidate:false,publishingAllowed:false,
        importedAt:new Date().toISOString(),
      }
      await s3.send(new PutObjectCommand({
        Bucket:process.env.BUCKET,Key:objectKey,Body:bytes,
        ContentType:'video/mp4',CacheControl:'private, max-age=31536000, immutable',
      }))
      await s3.send(new PutObjectCommand({
        Bucket:process.env.BUCKET,Key:metadataKey,
        Body:JSON.stringify(metadata,null,2),ContentType:'application/json',
        CacheControl:'private, no-store',
      }))
      entries.push(metadata)
      console.log('PEXELS_PRIVATE_SOURCE_STAGED',JSON.stringify({
        id:shot.id,beat:shot.beat,sourceSha256:metadata.videoSha256,
        dimensions:[metadata.width,metadata.height],approval:metadata.reviewStatus
      }))
    }
    const manifest={
      collection,provider:'Pexels',pexelsLink:'https://www.pexels.com/',
      license:'Pexels License',sourceClips:entries.length,
      status:'AWAITING_SOURCE_VISUAL_REVIEW',publishingLocked:true,
      noPaidGenerationCredits:true,assets:entries,generatedAt:new Date().toISOString(),
    }
    await s3.send(new PutObjectCommand({
      Bucket:process.env.BUCKET,Key:`${STORAGE_PREFIX}/${collection}/manifest.json`,
      Body:JSON.stringify(manifest,null,2),ContentType:'application/json',
      CacheControl:'private, no-store',
    }))
    return {ok:true,collection,provider:'Pexels',sourceClips:entries.length,
      reviewStatus:manifest.status,publishingLocked:true,
      pexelsLink:manifest.pexelsLink,
      candidates:entries.map(e=>({id:e.id,beat:e.beat,pageUrl:e.pageUrl,
        attribution:e.attribution,width:e.width,height:e.height,videoSha256:e.videoSha256}))}
  })()
  try{return await activeImport}finally{activeImport=null}
}
