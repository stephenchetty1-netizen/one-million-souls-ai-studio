import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3'
import {planVisualStory} from './visual-storyboard.mjs'
import {buildPexelsReviewStoryboard,createPexelsReviewScene} from './pexels-review-scenes.mjs'

const run=promisify(execFile)
const COLLECTION='BE_STILL_PEXELS_V1'
const TITLE='AMAZING GRACE'
const BPM=79
const SHOT_SECONDS=Number((8*60/BPM).toFixed(3))
const DURATION=Number((3*SHOT_SECONDS).toFixed(3))
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
async function checkedWork(file,kind,minDuration){
  const result=await probe(file)
  const duration=Number(result?.format?.duration)
  if(!Number.isFinite(duration)||duration<minDuration)
    throw new Error(kind+'_DURATION_INVALID')
  if(kind==='CHRISTIAN_MUSIC'&&!result?.streams?.some(s=>s.codec_type==='audio'))
    throw new Error('CHRISTIAN_MUSIC_AUDIO_STREAM_MISSING')
  if(kind==='MUSIC_VIDEO'){
    const v=result.streams?.find(s=>s.codec_type==='video')
    const rate=String(v?.r_frame_rate||'').split('/').map(Number)
    if(!v||v.width!==1080||v.height!==1920||
      !(rate[0]>=30*(rate[1]||1))||!result.streams?.some(s=>s.codec_type==='audio'))
      throw new Error('MUSIC_VIDEO_EXPORT_PROFILE_INVALID')
  }
  return duration
}
export const musicVideoContract=Object.freeze({
  title:TITLE,collection:COLLECTION,sourceTitle:MUSIC.title,
  musicSourcePage:MUSIC.sourcePage,musicLicense:MUSIC.license,
  bpmReference:BPM,secondsPerShot:SHOT_SECONDS,durationSeconds:DURATION,
  publishingAllowed:false,independentEditorialReviewRequired:true,
})
let activeDraft=null
export async function renderChristianMusicVideoDraft(){
  if(activeDraft)throw new Error('CHRISTIAN_MUSIC_VIDEO_ALREADY_RENDERING')
  if(!storageReady())throw new Error('CHRISTIAN_MUSIC_VIDEO_PRIVATE_STORAGE_REQUIRED')
  activeDraft=(async()=>{
    const id=crypto.randomUUID()
    const work=path.join(os.tmpdir(),'oms-christian-music-review',id)
    await fs.mkdir(work,{recursive:true})
    const s3=store()
    try{
      const audio=path.join(work,'amazing-grace-2011.mp3')
      const music=await cachedMusic(s3)
      await fs.writeFile(audio,music)
      await checkedWork(audio,'CHRISTIAN_MUSIC',35)
      const initial=planVisualStory({title:'BE STILL',script,scriptureReference:'Psalm 46:10'})
      const storyboard=buildPexelsReviewStoryboard(initial,COLLECTION)
      const scenes=[]
      for(let i=0;i<3;i++){
        const scene=await createPexelsReviewScene({collection:COLLECTION,index:i,work,
          seconds:SHOT_SECONDS,selection:storyboard.beats[i]})
        if(scene.source!=='rights-cleared-stock-video'||!scene.sourcePage?.startsWith('https://www.pexels.com/video/'))
          throw new Error('CHRISTIAN_MUSIC_VIDEO_PEXELS_RIGHTS_BLOCK')
        scenes.push(scene)
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
      const vf=[
        `drawtext=fontfile=${font}:textfile=${title}:fontsize=66:fontcolor=white:borderw=3:bordercolor=black@0.7:x=(w-text_w)/2:y=238:enable='between(t\\,0\\,4.9)'`,
        `drawtext=fontfile=${font}:textfile=${ref}:fontsize=36:fontcolor=white:borderw=2:bordercolor=black@0.8:x=(w-text_w)/2:y=1350:enable='between(t\\,10.0\\,18.2)'`,
        `drawtext=fontfile=${font}:textfile=${brand}:fontsize=25:fontcolor=white:borderw=2:bordercolor=black@0.75:x=(w-text_w)/2:y=1460`,
      ].join(',')
      try{await run('ffmpeg',['-y','-hide_banner','-loglevel','error',
        '-filter_complex_threads','1',
        '-f','concat','-safe','0','-i',listFile,
        '-ss','15','-i',audio,'-t',String(DURATION),
        '-filter_complex',`[0:v]${vf}[v];[1:a]atrim=duration=${DURATION},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.6,afade=t=out:st=17.0:d=1.228,loudnorm=I=-14:LRA=9:TP=-1.5[a]`,
        '-map','[v]','-map','[a]','-c:v','libx264','-threads','2','-preset','veryfast','-crf','18',
        '-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-ac','2',
        '-movflags','+faststart','-shortest',video],
        {timeout:210000,maxBuffer:10*1024*1024})
      }catch(error){
        const detail=String(error?.stderr||error?.message||'').slice(-3500)
        console.error('CHRISTIAN_MUSIC_VIDEO_COMPOSE_BLOCKED',JSON.stringify({
          code:error?.code||null,signal:error?.signal||null,stderr:detail,
          publishingAllowed:false
        }))
        throw new Error('CHRISTIAN_MUSIC_VIDEO_COMPOSE_FAILED: '+detail.slice(-900))
      }
      const duration=await checkedWork(video,'MUSIC_VIDEO',DURATION-0.3)
      await run('ffmpeg',['-v','error','-i',video,'-f','null','-'],
        {timeout:120000,maxBuffer:5*1024*1024})
      const buffer=await fs.readFile(video)
      if(buffer.length<1000000)throw new Error('MUSIC_VIDEO_UNEXPECTEDLY_SMALL')
      const key=`${PREFIX}/${id}.mp4`
      const contact=path.join(work,'contact.jpg')
      await run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',video,
        '-vf','fps=0.9,scale=216:384,tile=4x4','-frames:v','1',contact],
        {timeout:50000,maxBuffer:4*1024*1024})
      const sheet=await fs.readFile(contact)
      if(sheet.length<10000)throw new Error('MUSIC_VIDEO_CONTACT_SHEET_INVALID')
      const contactKey=`${PREFIX}/${id}-contact.jpg`
      const attribution=[MUSIC.officialCredit,
        'Music source: '+MUSIC.sourcePage,
        'Music licence: '+MUSIC.licenseUrl,
        'Footage: Tima Miroshnichenko via Pexels, https://www.pexels.com/; edited and colour-adjusted.',
        'No endorsement by any artist or depicted person is implied.'].join('\n')
      const asset={
        id,collection:COLLECTION,format:'MUSIC_LED_SHORT',title:'Amazing Grace | Christian Worship',
        contentType:'Christian instrumental worship reel',
        mediaUrl:`${publicBase()}/media/${key}`,masterHash:hash(buffer),
        contactSheetUrl:`${publicBase()}/media/${contactKey}`,contactSheetHash:hash(sheet),
        musicSourceHash:hash(music),music:MUSIC,
        sourceScenes:scenes.map(s=>({stockId:s.stockId,sourcePage:s.sourcePage,
          sourceVideoHash:s.sourceVideoHash,license:s.license,contributor:s.pexelsContributor})),
        suggestedCaption:'Amazing Grace | Be still and remember the grace of Jesus. John 1:16. #AmazingGrace #Jesus #ChristianMusic #Worship #OneMillionSouls\n\n'+attribution,
        measured:{width:1080,height:1920,fps:30,durationSeconds:duration,
          secondsPerVisualBeat:SHOT_SECONDS,fullDecodePassed:true},
        voiceover:false,lyricCaptions:false,editorialStatus:'AWAITING_FULL_AUDIOVISUAL_AND_RIGHTS_REVIEW',
        professionalMasterCandidate:false,masterReady:false,publishingAllowed:false,
        publishingLocked:true,providerCreditsUsed:0,generatedAt:new Date().toISOString(),
      }
      await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:key,Body:buffer,
        ContentType:'video/mp4',CacheControl:'public, max-age=31536000, immutable'}))
      await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:contactKey,Body:sheet,
        ContentType:'image/jpeg',CacheControl:'public, max-age=31536000, immutable'}))
      await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,
        Key:`internal/music-video-reviews/v1/${id}.json`,
        Body:JSON.stringify(asset,null,2),ContentType:'application/json',
        CacheControl:'private, no-store'}))
      console.log('CHRISTIAN_MUSIC_VIDEO_DRAFT_RESULT',JSON.stringify({
        id,mediaUrl:asset.mediaUrl,masterHash:asset.masterHash,contactSheetUrl:asset.contactSheetUrl,
        durationSeconds:duration,musicTitle:MUSIC.title,musicLicense:MUSIC.license,
        sourceFootage:asset.sourceScenes.map(s=>({id:s.stockId,license:s.license})),
        editorialStatus:asset.editorialStatus,publishingAllowed:false,
      }))
      return asset
    }finally{await fs.rm(work,{force:true,recursive:true}).catch(()=>{})}
  })()
  try{return await activeDraft}finally{activeDraft=null}
}
