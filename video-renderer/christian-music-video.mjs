import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3'
import {createChristianVideoTimelineScene,verifyChristianVideoSceneMetadata} from './christian-video-timeline.mjs'
import {CHRISTIAN_VIDEO_FORMATS,requireChristianVideoFormat,inspectChristianVideoSources,requireChristianVideoSources} from './christian-video-formats.mjs'

const run=promisify(execFile)
const COLLECTION='BE_STILL_PEXELS_V1'
const TITLE='AMAZING GRACE'
const ARCHIVED_PREVIEW_SECONDS=18.228
const MUSIC_START_SECONDS=15
const MAX_AUDIO=25*1024*1024
const PREFIX='music-video-review-v1'
const MUSIC={
  title:'Amazing Grace 2011',artist:'Kevin MacLeod',
  sourcePage:'https://commons.wikimedia.org/wiki/File:Amazing_Grace_2011_(ISRC_USUAN1100820).mp3',
  fileUrl:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Amazing_Grace_2011_%28ISRC_USUAN1100820%29.mp3',
  composerPage:'https://incompetech.com/',
  license:'CC BY 3.0',licenseUrl:'https://creativecommons.org/licenses/by/3.0/',
  officialCredit:'Amazing Grace 2011 Kevin MacLeod (incompetech.com) — CC BY 3.0; excerpt, fades and video synchronisation added.',
  genre:'Christian hymn instrumental: clarinet, pipe organ, piano',
}
const script='When the world feels loud, remember the amazing grace of Jesus Christ. Be still, open Scripture, and pray. His mercy meets you today. God gives grace upon grace, and you can draw near to Him.'
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex')
const storageReady=()=>Boolean(process.env.ENDPOINT&&process.env.BUCKET&&process.env.REGION&&process.env.ACCESS_KEY_ID&&process.env.SECRET_ACCESS_KEY)
const store=()=>new S3Client({endpoint:process.env.ENDPOINT,region:process.env.REGION,forcePathStyle:true,
  credentials:{accessKeyId:process.env.ACCESS_KEY_ID,secretAccessKey:process.env.SECRET_ACCESS_KEY}})
const publicBase=()=>String(process.env.PUBLIC_BASE_URL||(
  process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:
  'http://127.0.0.1:'+(process.env.PORT||3000)
)).replace(/\/$/,'')
async function fetchMusic(){
  const response=await fetch(MUSIC.fileUrl,{signal:AbortSignal.timeout(60000),redirect:'follow',
    headers:{'user-agent':'OneMillionSoulsRenderer/1.1 (licensed Christian hymn review; source caching)'}})
  const finalHost=new URL(response.url).hostname
  if(!response.ok)throw new Error('LICENSED_HYMN_DOWNLOAD_HTTP_'+response.status)
  if(!['commons.wikimedia.org','upload.wikimedia.org'].includes(finalHost))
    throw new Error('LICENSED_HYMN_UNTRUSTED_REDIRECT')
  const length=Number(response.headers.get('content-length')||0)
  if(length>MAX_AUDIO)throw new Error('LICENSED_HYMN_TOO_LARGE')
  const chunks=[]
  let size=0
  for await(const chunk of response.body){
    size+=chunk.length
    if(size>MAX_AUDIO)throw new Error('LICENSED_HYMN_TOO_LARGE')
    chunks.push(Buffer.from(chunk))
  }
  if(size<100000)throw new Error('LICENSED_HYMN_EMPTY')
  return Buffer.concat(chunks,size)
}
async function cachedMusic(s3){
  const key='internal/licensed-music/v1/amazing-grace-2011-macleod.mp3'
  try{
    const obj=await s3.send(new GetObjectCommand({Bucket:process.env.BUCKET,Key:key}))
    const b=Buffer.from(await obj.Body.transformToByteArray())
    if(b.length>=100000&&b.length<=MAX_AUDIO){
      console.log('CHRISTIAN_MUSIC_CACHE_HIT',JSON.stringify({title:MUSIC.title,sha256:hash(b)}))
      return b
    }
  }catch(e){
    if(!['NoSuchKey','NotFound'].includes(e?.name||''))
      console.warn('CHRISTIAN_MUSIC_CACHE_READ_MISS',JSON.stringify({error:e?.name||'read failed'}))
  }
  const b=await fetchMusic()
  await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:key,Body:b,
    ContentType:'audio/mpeg',CacheControl:'private, max-age=31536000, immutable'}))
  console.log('CHRISTIAN_MUSIC_CACHE_STORE',JSON.stringify({title:MUSIC.title,sha256:hash(b),bytes:b.length}))
  return b
}
async function probe(file){
  const {stdout}=await run('ffprobe',['-v','error','-show_entries',
    'format=duration:stream=codec_type,width,height,r_frame_rate','-of','json',file],
    {timeout:30000,maxBuffer:2*1024*1024})
  return JSON.parse(stdout)
}
async function checkedWork(file,kind,minDuration,profile=null){
  const result=await probe(file)
  const duration=Number(result?.format?.duration)
  if(!Number.isFinite(duration)||duration<minDuration)
    throw new Error(kind+'_DURATION_INVALID')
  if(kind==='CHRISTIAN_MUSIC'&&!result?.streams?.some(s=>s.codec_type==='audio'))
    throw new Error('CHRISTIAN_MUSIC_AUDIO_STREAM_MISSING')
  if(kind==='MUSIC_VIDEO'){
    const v=result.streams?.find(s=>s.codec_type==='video')
    const rate=String(v?.r_frame_rate||'').split('/').map(Number)
    if(!profile||!v||v.width!==profile.width||v.height!==profile.height||
      !(rate[0]>=profile.fps*(rate[1]||1))||!result.streams?.some(s=>s.codec_type==='audio'))
      throw new Error('MUSIC_VIDEO_EXPORT_PROFILE_INVALID')
  }
  return duration
}
// A distinct four-minute arrangement, not a false claim that the recording is
// four minutes long. The 3:09 hymn becomes a 4:00 edit with a gentle reprise.
export function planChristianMusicAudio(format,musicDuration){
 const profile=requireChristianVideoFormat(format)
 if(format==='YOUTUBE_LONG'){
   const lead=186,repriseStart=20,repriseSeconds=57,crossfade=3
   const arrangedSeconds=lead+repriseSeconds-crossfade
   if(!(musicDuration>=lead+0.3&&musicDuration>=repriseStart+repriseSeconds+0.3)
     ||arrangedSeconds!==profile.durationSeconds)
     throw new Error('CHRISTIAN_LONG_HYMN_SOURCE_OR_ARRANGEMENT_INVALID')
   return {format,arrangedSeconds,originalSeconds:musicDuration,
     leadSeconds:lead,repriseStart,repriseSeconds,crossfadeSeconds:crossfade,
     creditsNote:'Four-minute adaptation: the original recording is edited into a lead section and one credited musical reprise with a three-second crossfade.'}
 }
 if(!(musicDuration>=MUSIC_START_SECONDS+profile.durationSeconds+0.5))
   throw new Error('CHRISTIAN_SHORT_HYMN_SOURCE_TOO_SHORT')
 return {format,arrangedSeconds:profile.durationSeconds,
   originalSeconds:musicDuration,sourceStartSeconds:MUSIC_START_SECONDS,
   creditsNote:'Short-form excerpt with fades and synchronisation.'}
}
export const musicVideoContract=Object.freeze({
  title:TITLE,collection:COLLECTION,sourceTitle:MUSIC.title,
  musicSourcePage:MUSIC.sourcePage,musicLicense:MUSIC.license,
  formats:CHRISTIAN_VIDEO_FORMATS,
  shortDurationSeconds:59,longFormDurationSeconds:240,
  archivedPreviewDurationSeconds:ARCHIVED_PREVIEW_SECONDS,
  publishingAllowed:false,independentEditorialReviewRequired:true,
})
async function readPexelsSourceInventory(s3,format){
  const key=format.id==='SHORT_59'
    ?'internal/pexels-source-candidates/v1/BE_STILL_PEXELS_V1/manifest.json'
    :'internal/pexels-source-candidates/v1/YOUTUBE_WORSHIP_LANDSCAPE_V1/manifest.json'
  try{
    const obj=await s3.send(new GetObjectCommand({Bucket:process.env.BUCKET,Key:key}))
    const json=JSON.parse(await obj.Body.transformToString())
    return Array.isArray(json?.assets)?json.assets:[]
  }catch(error){
    if(!['NoSuchKey','NotFound'].includes(error?.name||''))
      console.warn('CHRISTIAN_VIDEO_SOURCE_MANIFEST_UNAVAILABLE',JSON.stringify({
        format:format.id,reason:error?.name||'read failed'
      }))
    return []
  }
}
export async function inspectChristianVideoFormatReadiness(formatId='SHORT_59'){
  const format=requireChristianVideoFormat(formatId)
  if(!storageReady())throw new Error('CHRISTIAN_MUSIC_VIDEO_PRIVATE_STORAGE_REQUIRED')
  const assets=await readPexelsSourceInventory(store(),format)
  const visualReadiness=inspectChristianVideoSources(formatId,assets,Infinity)
  return {formatId,format,sourceClipsStaged:assets.length,
    distinctPortraitOrLandscapeClips:visualReadiness.eligibleDistinctClips,
    requiredDistinctClips:format.minimumDistinctClips,
    // Music file duration gets checked separately before any actual rendering.
    visualSourcesReady:visualReadiness.blockers.length===0,
    blockers:visualReadiness.blockers,
    musicDurationChecked:false,publishingAllowed:false,independentEditorialReviewRequired:true}
}
let activeDraft=null
export async function renderChristianMusicVideoDraft({format='SHORT_59'}={}){
  const profile=requireChristianVideoFormat(format)
  if(activeDraft)throw new Error('CHRISTIAN_MUSIC_VIDEO_ALREADY_RENDERING')
  if(!storageReady())throw new Error('CHRISTIAN_MUSIC_VIDEO_PRIVATE_STORAGE_REQUIRED')
  activeDraft=(async()=>{
    const id=crypto.randomUUID()
    const work=path.join(os.tmpdir(),'oms-christian-music-review',id)
    await fs.mkdir(work,{recursive:true})
    const s3=store()
    try{
      const staged=await readPexelsSourceInventory(s3,profile)
      // The old 18-second three-shot preview must never be stretched or looped
      // to claim a 59-second reel or four-minute landscape YouTube video.
      const preflight=inspectChristianVideoSources(format,staged,Infinity)
      if(!preflight.readyForDraftRender)
        throw new Error('CHRISTIAN_VIDEO_FORMAT_SOURCES_BLOCKED: '+preflight.blockers.join(';'))
      const audio=path.join(work,'amazing-grace-2011.mp3')
      const music=await cachedMusic(s3)
      await fs.writeFile(audio,music)
      const musicDuration=await checkedWork(audio,'CHRISTIAN_MUSIC',
        format==='YOUTUBE_LONG'?186.3:profile.requiredAudioSeconds+MUSIC_START_SECONDS+0.5)
      const audioPlan=planChristianMusicAudio(format,musicDuration)
      requireChristianVideoSources(format,staged,audioPlan.arrangedSeconds+1)
      const collection=format==='SHORT_59'?'BE_STILL_PEXELS_V1':'YOUTUBE_WORSHIP_LANDSCAPE_V1'
      const eligible=staged.filter(source=>{
        try{verifyChristianVideoSceneMetadata(source,format,collection);return true}
        catch{return false}
      })
      const selected=eligible.slice(0,profile.minimumDistinctClips)
      if(new Set(selected.map(x=>x.id)).size!==profile.minimumDistinctClips)
        throw new Error('CHRISTIAN_VIDEO_DUPLICATE_OR_MISSING_TIMELINE_SOURCE')
      const scenes=[]
      for(let i=0;i<selected.length;i++){
        const scene=await createChristianVideoTimelineScene({
          store:s3,bucket:process.env.BUCKET,source:selected[i],
          formatId:format,collection,index:i,work
        })
        scenes.push(scene)
        console.log('CHRISTIAN_VIDEO_TIMELINE_SCENE_READY',JSON.stringify({
          format,index:i+1,total:selected.length,stockId:scene.stockId,publishingAllowed:false
        }))
      }
      const listFile=path.join(work,'concat.txt')
      await fs.writeFile(listFile,scenes.map(s=>"file '"+s.local.replace(/'/g,"'\\''")+"'").join('\n')+'\n')
      const title=path.join(work,'title.txt'),ref=path.join(work,'scripture.txt'),brand=path.join(work,'brand.txt')
      await Promise.all([
        fs.writeFile(title,'AMAZING GRACE\n'),
        fs.writeFile(ref,'GRACE UPON GRACE  |  JOHN 1:16\n'),
        fs.writeFile(brand,'ONE MILLION SOULS  |  JESUS CHRIST\n'),
      ])
      const video=path.join(work,'amazing-grace-review.mp4')
      const font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
      const portrait=profile.orientation==='portrait'
      const titleFont=portrait?66:58
      const refFont=portrait?36:39
      const brandFont=portrait?25:28
      const titleY=Math.floor(profile.height*0.125)
      const referenceY=Math.floor(profile.height*0.70)
      const brandY=Math.floor(profile.height*0.76)
      const referenceStart=Number((profile.durationSeconds*0.36).toFixed(3))
      const referenceEnd=Number((profile.durationSeconds*0.83).toFixed(3))
      const titleEnd=Number(Math.min(7,profile.durationSeconds*0.13).toFixed(3))
      const audioFadeStart=Number((profile.durationSeconds-1.25).toFixed(3))
      const sourceOffset=format==='YOUTUBE_LONG'?0:MUSIC_START_SECONDS
      const filterAudio=format==='YOUTUBE_LONG'
        ?`[1:a]asplit=2[am][ar];[am]atrim=start=0:duration=186,asetpts=PTS-STARTPTS[lead];[ar]atrim=start=20:duration=57,asetpts=PTS-STARTPTS[reprise];[lead][reprise]acrossfade=d=3:c1=tri:c2=tri,atrim=duration=240,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.6,afade=t=out:st=238.75:d=1.25,loudnorm=I=-14:LRA=9:TP=-1.5[a]`
        :`[1:a]atrim=duration=${profile.durationSeconds},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.6,afade=t=out:st=${audioFadeStart}:d=1.25,loudnorm=I=-14:LRA=9:TP=-1.5[a]`
      const vf=[
        `drawtext=fontfile=${font}:textfile=${title}:fontsize=${titleFont}:fontcolor=white:borderw=3:bordercolor=black@0.7:x=(w-text_w)/2:y=${titleY}:enable='between(t\\,0\\,${titleEnd})'`,
        `drawtext=fontfile=${font}:textfile=${ref}:fontsize=${refFont}:fontcolor=white:borderw=2:bordercolor=black@0.8:x=(w-text_w)/2:y=${referenceY}:enable='between(t\\,${referenceStart}\\,${referenceEnd})'`,
        `drawtext=fontfile=${font}:textfile=${brand}:fontsize=${brandFont}:fontcolor=white:borderw=2:bordercolor=black@0.75:x=(w-text_w)/2:y=${brandY}`,
      ].join(',')
      try{await run('ffmpeg',['-y','-hide_banner','-loglevel','error',
        '-filter_complex_threads','1',
        '-f','concat','-safe','0','-i',listFile,
        '-ss',String(sourceOffset),'-i',audio,'-t',String(profile.durationSeconds),
        '-filter_complex',`[0:v]${vf}[v];${filterAudio}`,
        '-map','[v]','-map','[a]','-c:v','libx264','-threads','2','-preset','veryfast','-crf','18',
        '-pix_fmt','yuv420p','-r',String(profile.fps),'-c:a','aac','-b:a','192k','-ac','2',
        '-movflags','+faststart','-shortest',video],
        {timeout:format==='YOUTUBE_LONG'?900000:300000,maxBuffer:10*1024*1024})
      }catch(error){
        const detail=String(error?.stderr||error?.message||'').slice(-3500)
        console.error('CHRISTIAN_MUSIC_VIDEO_COMPOSE_BLOCKED',JSON.stringify({
          code:error?.code||null,signal:error?.signal||null,stderr:detail,
          publishingAllowed:false
        }))
        throw new Error('CHRISTIAN_MUSIC_VIDEO_COMPOSE_FAILED: '+detail.slice(-900))
      }
      const duration=await checkedWork(video,'MUSIC_VIDEO',profile.durationSeconds-0.3,profile)
      if(Math.abs(duration-profile.durationSeconds)>0.22)
        throw new Error('CHRISTIAN_VIDEO_TARGET_DURATION_MISMATCH')
      await run('ffmpeg',['-v','error','-i',video,'-f','null','-'],
        {timeout:format==='YOUTUBE_LONG'?600000:180000,maxBuffer:5*1024*1024})
      const buffer=await fs.readFile(video)
      if(buffer.length<1000000)throw new Error('MUSIC_VIDEO_UNEXPECTEDLY_SMALL')
      const key=`${PREFIX}/${format}/${id}.mp4`
      const contact=path.join(work,'contact.jpg')
      await run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',video,
        '-vf',portrait?'fps=0.25,scale=216:384,tile=4x4':'fps=0.062,scale=384:216,tile=4x4','-frames:v','1',contact],
        {timeout:50000,maxBuffer:4*1024*1024})
      const sheet=await fs.readFile(contact)
      if(sheet.length<10000)throw new Error('MUSIC_VIDEO_CONTACT_SHEET_INVALID')
      const contactKey=`${PREFIX}/${format}/${id}-contact.jpg`
      const attribution=[MUSIC.officialCredit,audioPlan.creditsNote,
        'Music source: '+MUSIC.sourcePage,
        'Music licence: '+MUSIC.licenseUrl,
        'Footage: Tima Miroshnichenko via Pexels, https://www.pexels.com/; edited and colour-adjusted.',
        'No endorsement by any artist or depicted person is implied.'].join('\n')
      const asset={
        id,collection,format:profile.format,profileId:format,title:'Amazing Grace | Christian Worship',
        contentType:'Christian instrumental worship reel',
        mediaUrl:`${publicBase()}/media/${key}`,masterHash:hash(buffer),
        contactSheetUrl:`${publicBase()}/media/${contactKey}`,contactSheetHash:hash(sheet),
        musicSourceHash:hash(music),music:MUSIC,audioArrangement:audioPlan,
        sourceScenes:scenes.map(s=>({stockId:s.stockId,sourcePage:s.sourcePage,
          sourceVideoHash:s.sourceVideoHash,license:s.license,contributor:s.pexelsContributor})),
        suggestedCaption:'Amazing Grace | Be still and remember the grace of Jesus. John 1:16. #AmazingGrace #Jesus #ChristianMusic #Worship #OneMillionSouls\n\n'+attribution,
        measured:{width:profile.width,height:profile.height,fps:profile.fps,durationSeconds:duration,
          targetSeconds:profile.durationSeconds,secondsPerVisualBeat:profile.secondsPerScene,
          sourceClips:scenes.length,allSourcesDistinct:true,fullDecodePassed:true},
        voiceover:false,lyricCaptions:false,editorialStatus:'AWAITING_FULL_AUDIOVISUAL_AND_RIGHTS_REVIEW',
        professionalMasterCandidate:false,masterReady:false,publishingAllowed:false,
        publishingLocked:true,providerCreditsUsed:0,generatedAt:new Date().toISOString(),
      }
      await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:key,Body:buffer,
        ContentType:'video/mp4',CacheControl:'public, max-age=31536000, immutable'}))
      await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:contactKey,Body:sheet,
        ContentType:'image/jpeg',CacheControl:'public, max-age=31536000, immutable'}))
      await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,
        Key:`internal/music-video-reviews/v1/${format}/${id}.json`,
        Body:JSON.stringify(asset,null,2),ContentType:'application/json',
        CacheControl:'private, no-store'}))
      console.log('CHRISTIAN_MUSIC_VIDEO_DRAFT_RESULT',JSON.stringify({
        id,profileId:format,mediaUrl:asset.mediaUrl,masterHash:asset.masterHash,contactSheetUrl:asset.contactSheetUrl,
        durationSeconds:duration,targetSeconds:profile.durationSeconds,musicTitle:MUSIC.title,musicLicense:MUSIC.license,sourceMusicSeconds:musicDuration,arrangement:audioPlan.creditsNote,
        sourceFootage:asset.sourceScenes.map(s=>({id:s.stockId,license:s.license})),
        editorialStatus:asset.editorialStatus,publishingAllowed:false,
      }))
      return asset
    }finally{await fs.rm(work,{force:true,recursive:true}).catch(()=>{})}
  })()
  try{return await activeDraft}finally{activeDraft=null}
}
