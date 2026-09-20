import {promises as fs} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {S3Client,GetObjectCommand,PutObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3'
import {createChristianVideoTimelineScene} from './christian-video-timeline.mjs'
import {inspectChristianVideoSources,CHRISTIAN_VIDEO_FORMATS} from './christian-video-formats.mjs'
import {christianVisualSourceReviewed} from './christian-visual-editorial-gate.mjs'
const run=promisify(execFile)
const PROFILE=CHRISTIAN_VIDEO_FORMATS.SHORT_59
const PREFIX='internal/pexels-source-candidates/v1/BE_STILL_PEXELS_V1'
const MUSIC_KEY='internal/licensed-music/v1/amazing-grace-2011-macleod.mp3'
const MUSIC_URL='https://commons.wikimedia.org/wiki/Special:Redirect/file/Amazing_Grace_2011_%28ISRC_USUAN1100820%29.mp3'
const MUSIC_CREDIT='Amazing Grace 2011 by Kevin MacLeod (incompetech.com), CC BY 3.0; edited, shortened and mixed with narration.'
export const NARRATED_SHORT=Object.freeze({
 title:'JESUS HAS NOT GIVEN UP ON YOU',
 reference:'Philippians 1:6',
 // Editorial script is purpose-built for a 59-second narrated devotional.
 script:"What if the chapter you wanted to end is the chapter where God begins something new? You may feel tired. You may feel forgotten. You may think your mistakes have the final word. But listen to this promise from Philippians chapter one, verse six: God will complete the good work He began in you. Your pain is not your identity. Your past is not your destination. Take one faithful step today. Open your Bible. Speak to Jesus. Ask Him for strength, and trust Him with the next step. You do not have to see the whole road to follow the One who leads you. God is still working. Keep your eyes on Jesus.",
 closing:'GOD IS STILL WORKING IN YOU',
 targetSeconds:59,requiredDistinctClips:9,needsVoiceover:true,needsSpokenScript:true,needsCaptions:true,
 publishingAllowed:false
})
export function reviewNarratedShortScript(script=NARRATED_SHORT.script){
 const words=String(script).trim().split(/\s+/).filter(Boolean)
 if(words.length<90||words.length>145)throw new Error('NARRATED_SHORT_SCRIPT_WORD_COUNT_OUT_OF_RANGE')
 if(!/\bJesus\b/i.test(script)||!/\bGod\b/i.test(script)||!/\bBible\b/i.test(script))
  throw new Error('NARRATED_SHORT_CHRISTIAN_SCRIPT_INCOMPLETE')
 return {wordCount:words.length,wordsPerMinute:Math.round(words.length*60/PROFILE.durationSeconds)}
}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
function storage(){
 if(!['ENDPOINT','REGION','BUCKET','ACCESS_KEY_ID','SECRET_ACCESS_KEY'].every(k=>process.env[k]))
  throw new Error('PRIVATE_STORAGE_REQUIRED')
 return new S3Client({endpoint:process.env.ENDPOINT,region:process.env.REGION,forcePathStyle:true,
  credentials:{accessKeyId:process.env.ACCESS_KEY_ID,secretAccessKey:process.env.SECRET_ACCESS_KEY}})
}
function base(){
 return String(process.env.PUBLIC_BASE_URL||(
  process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:
  'http://127.0.0.1:'+(process.env.PORT||3000))).replace(/\/$/,'')
}
async function objectBytes(s3,key,limit=32*1024*1024){
 const result=await s3.send(new GetObjectCommand({Bucket:process.env.BUCKET,Key:key}))
 if(Number(result.ContentLength||0)>limit)throw new Error('SOURCE_TOO_LARGE')
 const bytes=Buffer.from(await result.Body.transformToByteArray())
 if(bytes.length>limit||bytes.length<10000)throw new Error('SOURCE_EMPTY_OR_TOO_LARGE')
 return bytes
}
async function music(s3){
 try{return await objectBytes(s3,MUSIC_KEY)}catch(e){
  if(!['NoSuchKey','NotFound'].includes(String(e?.name||'')))throw e
 }
 const response=await fetch(MUSIC_URL,{redirect:'follow',signal:AbortSignal.timeout(60000)})
 if(!response.ok||!['commons.wikimedia.org','upload.wikimedia.org'].includes(new URL(response.url).hostname))
  throw new Error('LICENSED_HYMN_DOWNLOAD_FAILED')
 const bytes=Buffer.from(await response.arrayBuffer())
 if(bytes.length<100000||bytes.length>25*1024*1024)throw new Error('LICENSED_HYMN_INVALID')
 await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:MUSIC_KEY,
  Body:bytes,ContentType:'audio/mpeg',CacheControl:'private, max-age=31536000, immutable'}))
 return bytes
}
async function ffprobe(file){
 const {stdout}=await run('ffprobe',['-v','error','-show_entries',
  'format=duration:stream=codec_type,width,height,r_frame_rate','-of','json',file],
  {timeout:30000,maxBuffer:2*1024*1024})
 return JSON.parse(stdout)
}
const ts=n=>{const t=Math.round(n*100);return '0:'+
 String(Math.floor(t/6000)).padStart(2,'0')+':'+
 String(Math.floor(t%6000/100)).padStart(2,'0')+'.'+
 String(t%100).padStart(2,'0')}
export function captionAss(script=NARRATED_SHORT.script,duration=59){
 const words=String(script).trim().split(/\s+/).filter(Boolean)
 if(!words.length)throw new Error('CAPTION_SCRIPT_REQUIRED')
 const phrases=[];for(let i=0;i<words.length;i+=4)phrases.push(words.slice(i,i+4).join(' '))
 const starts=[0];for(const phrase of phrases)starts.push(starts.at(-1)+phrase.split(/\s+/).length)
 const lines=[
  '[Script Info]','ScriptType: v4.00+','PlayResX: 1080','PlayResY: 1920','WrapStyle: 2',
  'ScaledBorderAndShadow: yes','',
  '[V4+ Styles]',
  'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
  'Style: Caption,DejaVu Sans,63,&H00FFFFFF,&H00FFFFFF,&H00131A24,&H980A142B,-1,0,0,0,100,100,0,0,3,2,1,2,125,125,490,1',
  '','[Events]','Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
 ]
 const speakingEnd=duration-2.25
 for(let i=0;i<phrases.length;i++){
  const start=starts[i]/words.length*speakingEnd
  const end=starts[i+1]/words.length*speakingEnd
  const phrase=phrases[i].replace(/[{}]/g,'').replace(/,/g,'\u002c')
  lines.push('Dialogue: 0,'+ts(start)+','+ts(end)+',Caption,,0,0,0,,'+phrase)
 }
 return lines.join('\n')+'\n'
}
let active=null
export async function renderChristianNarratedShortDraft({reviewPreview=false}={}){
 if(reviewPreview&&process.env.CHRISTIAN_UNREVIEWED_DRAFT_ENABLED!=='true')
  throw new Error('UNREVIEWED_SOURCE_DRAFT_DISABLED')
 if(active)throw new Error('NARRATED_SHORT_ALREADY_RENDERING')
 active=(async()=>{
  reviewNarratedShortScript()
  const id=crypto.randomUUID(),dir=path.join(os.tmpdir(),'oms-narrated-59',id)
  await fs.mkdir(dir,{recursive:true})
  const s3=storage()
  try{
   const obj=await s3.send(new GetObjectCommand({Bucket:process.env.BUCKET,
    Key:PREFIX+'/manifest.json'}))
   const manifest=JSON.parse(await obj.Body.transformToString())
   const sources=Array.isArray(manifest?.assets)?manifest.assets:[]
   // A private preview may be composed from unreviewed, technically verified
   // Pexels sources so the editor can evaluate the ACTUAL complete moving video.
   // This is never source approval or master certification. Rejected shots are
   // excluded. The existing fully reviewed release-draft path is unchanged.
   const selected=(reviewPreview
    ?sources.filter(x=>x?.reviewStatus!=='REJECTED_CHRISTIAN_STORY_FIT'&&
      x?.visualChristianEditorialStatus!=='REJECTED_CHRISTIAN_STORY_FIT')
    :sources.filter(christianVisualSourceReviewed)).slice(0,9)
   const sourcePreflight=inspectChristianVideoSources('SHORT_59',selected,Infinity)
   if(!sourcePreflight.readyForDraftRender||selected.length!==9)
    throw new Error((reviewPreview?'NARRATED_SHORT_PREVIEW_REQUIRES_NINE_VALID_CLIPS: ':
      'NARRATED_SHORT_REQUIRES_NINE_REVIEWED_DISTINCT_CHRISTIAN_CLIPS: ')+
      sourcePreflight.blockers.join(';'))
   const sourceBankHash=sha(Buffer.from(JSON.stringify({
    script:NARRATED_SHORT.script,
    sources:selected.map(x=>[x.id,x.videoSha256,x.reviewStatus])
   })))
   const previewLatestKey='internal/unreviewed-narrated-short-reviews/v1/latest.json'
   if(reviewPreview){
    try{
     const stored=await s3.send(new GetObjectCommand({
      Bucket:process.env.BUCKET,Key:previewLatestKey
     }))
     const previous=JSON.parse(await stored.Body.transformToString())
     if(previous?.sourceBankHash===sourceBankHash&&previous?.id&&
       /^[a-f0-9-]{36}$/i.test(previous.id)&&
       /^[a-f0-9]{64}$/i.test(previous.masterHash)){
       await s3.send(new HeadObjectCommand({Bucket:process.env.BUCKET,
        Key:'internal/unreviewed-narrated-short-draft/v1/'+previous.id+'.mp4'}))
       console.log('CHRISTIAN_PRIVATE_SHORT_PREVIEW_REUSED',
        JSON.stringify({id:previous.id,masterHash:previous.masterHash,publishingAllowed:false}))
       return previous
     }
    }catch(error){
     if(!['NoSuchKey','NotFound'].includes(String(error?.name||'')))
      console.warn('CHRISTIAN_PRIVATE_PREVIEW_CACHE_MISS',
       JSON.stringify({reason:String(error?.name||'unavailable')}))
    }
   }
   const localVoice=path.join(dir,'narration.mp3')
   const cli=path.join(process.cwd(),'node_modules','.bin','node-edge-tts')
   await run(cli,['-t',NARRATED_SHORT.script,'-f',localVoice,'-v',
    process.env.EDGE_TTS_VOICE||'en-ZA-LeahNeural','-l','en-ZA','--rate=-4%',
    '--timeout','90000'],{timeout:110000,maxBuffer:5*1024*1024})
   const voiceProfile=await ffprobe(localVoice)
   const voiceDuration=Number(voiceProfile.format?.duration)
   if(!Number.isFinite(voiceDuration)||!voiceProfile.streams?.some(x=>x.codec_type==='audio'))
    throw new Error('NARRATED_SHORT_VOICEOVER_NOT_GENERATED')
   const tempo=voiceDuration/(PROFILE.durationSeconds-2.25)
   if(tempo<0.78||tempo>1.25)throw new Error('NARRATED_SHORT_REWRITE_FOR_NATURAL_VOICE_PACING: '+voiceDuration)
   const localMusic=path.join(dir,'licensed-amazing-grace.mp3')
   const soundtrack=await music(s3)
   await fs.writeFile(localMusic,soundtrack)
   const localScenes=[]
   for(let i=0;i<selected.length;i++)
    localScenes.push(await createChristianVideoTimelineScene({store:s3,bucket:process.env.BUCKET,
     source:selected[i],formatId:'SHORT_59',collection:'BE_STILL_PEXELS_V1',index:i,work:dir}))
   const concat=path.join(dir,'timeline.txt')
   await fs.writeFile(concat,localScenes.map(x=>"file '"+x.local.replace(/'/g,"'\\''")+"'").join('\n')+'\n')
   const captions=path.join(dir,'captions.ass'),title=path.join(dir,'hook.txt'),
    verse=path.join(dir,'verse.txt'),end=path.join(dir,'end.txt'),brand=path.join(dir,'brand.txt'),
    struggle=path.join(dir,'struggle.txt'),action=path.join(dir,'action.txt'),
    promise=path.join(dir,'promise.txt')
   await Promise.all([
    fs.writeFile(captions,captionAss()),
    fs.writeFile(title,'GOD IS NOT\nFINISHED WITH YOU\n'),
    fs.writeFile(verse,'PHILIPPIANS 1:6  |  JESUS CHRIST\n'),
    fs.writeFile(end,NARRATED_SHORT.closing+'\n'),
    fs.writeFile(brand,'ONE MILLION SOULS  |  ONE SAVIOUR\n'),
    fs.writeFile(struggle,'YOU ARE NOT FORGOTTEN\n'),
    fs.writeFile(promise,'HE WILL FINISH THE GOOD WORK\n'),
    fs.writeFile(action,'PRAY. TRUST. TAKE ONE STEP.\n')
   ])
   const out=path.join(dir,'narrated-master-draft.mp4')
   const font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
   const vf=[
    'fps=30','trim=duration=59','setpts=PTS-STARTPTS',
    'eq=contrast=1.045:saturation=1.06',
    "drawbox=x=0:y=0:w=iw:h=490:color=black@0.26:t=fill:enable='between(t\\,0\\,5.0)'",
    'drawtext=fontfile='+font+':textfile='+title+
     ":fontsize=68:fontcolor=white:borderw=3:bordercolor=black@0.7:x=(w-text_w)/2:y=240:enable='between(t\\,0\\,4.6)'",
    'ass='+captions+':fontsdir=/usr/share/fonts/truetype/dejavu',
    'drawtext=fontfile='+font+':textfile='+struggle+
     ":fontsize=45:fontcolor=white:borderw=3:bordercolor=black@0.8:x=(w-text_w)/2:y=280:enable='between(t\\,8\\,15)'",
    'drawtext=fontfile='+font+':textfile='+promise+
     ":fontsize=33:fontcolor=white:borderw=3:bordercolor=black@0.8:x=(w-text_w)/2:y=280:enable='between(t\\,29\\,36)'",
    'drawtext=fontfile='+font+':textfile='+action+
     ":fontsize=40:fontcolor=white:borderw=3:bordercolor=black@0.8:x=(w-text_w)/2:y=280:enable='between(t\\,44\\,52)'",
    'drawtext=fontfile='+font+':textfile='+verse+
     ":fontsize=32:fontcolor=white:borderw=2:bordercolor=black@0.8:x=(w-text_w)/2:y=1180:enable='between(t\\,20\\,39)'",
    'drawtext=fontfile='+font+':textfile='+end+
     ":fontsize=42:fontcolor=white:borderw=3:bordercolor=black@0.8:x=(w-text_w)/2:y=270:enable='between(t\\,56\\,59)'",
    'drawtext=fontfile='+font+':textfile='+brand+
     ':fontsize=26:fontcolor=white:borderw=2:bordercolor=black@0.75:x=(w-text_w)/2:y=1790'
   ].join(',')
   const fade=57.6
   await run('ffmpeg',['-y','-hide_banner','-loglevel','error',
    '-f','concat','-safe','0','-i',concat,
    '-i',localVoice,'-stream_loop','-1','-ss','15','-i',localMusic,
    '-t','59','-filter_complex_threads','1',
    '-filter_complex','[0:v]'+vf+'[v];'+
      '[1:a]atempo='+tempo.toFixed(5)+',highpass=f=85,lowpass=f=13500,'+
      'acompressor=threshold=0.11:ratio=2.2,apad=pad_dur=3,atrim=duration=59[voice];'+
      '[2:a]volume=0.10,afade=t=out:st='+fade+':d=1.4,atrim=duration=59[bed];'+
      '[voice][bed]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:LRA=8:TP=-1.5[a]',
    '-map','[v]','-map','[a]','-c:v','libx264','-threads','2','-preset','veryfast',
    '-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-ac','2','-b:a','192k',
    '-movflags','+faststart',out],{timeout:600000,maxBuffer:10*1024*1024})
   const media=await ffprobe(out),duration=Number(media.format?.duration)
   const v=media.streams?.find(x=>x.codec_type==='video'),a=media.streams?.find(x=>x.codec_type==='audio')
   if(!v||!a||v.width!==1080||v.height!==1920||Math.abs(duration-59)>0.25)
    throw new Error('NARRATED_SHORT_FULL_MASTER_EXPORT_INVALID')
   await run('ffmpeg',['-v','error','-i',out,'-f','null','-'],
    {timeout:210000,maxBuffer:4*1024*1024})
   const bytes=await fs.readFile(out)
   if(bytes.length<1000000)throw new Error('NARRATED_SHORT_MASTER_UNEXPECTEDLY_SMALL')
   const contact=path.join(dir,'contact.jpg')
   await run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',out,
    '-vf','fps=0.25,scale=216:384,tile=4x4','-frames:v','1',contact],
    {timeout:60000,maxBuffer:5*1024*1024})
   const contactBytes=await fs.readFile(contact)
   const draftPrefix=reviewPreview?'internal/unreviewed-narrated-short-draft/v1/':'narrated-short-review-v1/'
   const key=draftPrefix+id+'.mp4',contactKey=draftPrefix+id+'-contact.jpg'
   await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:key,Body:bytes,
    ContentType:'video/mp4',CacheControl:'private, no-store'}))
   await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,Key:contactKey,Body:contactBytes,
    ContentType:'image/jpeg',CacheControl:'private, no-store'}))
   const result={
    id,title:NARRATED_SHORT.title,script:NARRATED_SHORT.script,scriptureReference:NARRATED_SHORT.reference,
    mediaUrl:reviewPreview?base()+'/christian-private-preview?kind=video&id='+id:
     base()+'/media/'+key,
    contactSheetUrl:reviewPreview?base()+'/christian-private-preview?kind=contact&id='+id:
     base()+'/media/'+contactKey,
    sourceBankHash,unreviewedSourcePreview:reviewPreview,sourceReviewRequired:reviewPreview,
    masterHash:sha(bytes),contactSheetHash:sha(contactBytes),voiceSourceHash:sha(await fs.readFile(localVoice)),
    musicSourceHash:sha(soundtrack),sourceScenes:selected.map(x=>({id:x.id,sourceVideoHash:x.videoSha256,
     pageUrl:x.pageUrl,visualReviewer:x.visualReviewer,visualReviewedAt:x.visualReviewedAt})),
    voiceover:true,narrationPresent:true,onScreenWords:true,captionsPresent:true,scriptPresent:true,
    wordCount:reviewNarratedShortScript().wordCount,
    captionTiming:'ESTIMATED_PROPORTIONAL_WORD_TIMING_REQUIRES_FINAL_AUDIO_SYNC_REVIEW',
    music:{title:'Amazing Grace 2011',composer:'Kevin MacLeod',license:'CC BY 3.0',
      attribution:MUSIC_CREDIT,source:'https://commons.wikimedia.org/wiki/File:Amazing_Grace_2011_(ISRC_USUAN1100820).mp3'},
    measured:{width:1080,height:1920,fps:30,durationSeconds:duration,fullDecodePassed:true,
      distinctSourceClips:selected.length},
    editorialStatus:reviewPreview?'UNREVIEWED_SOURCE_PREVIEW_ONLY':
     'AWAITING_FINAL_AUDIOVISUAL_AND_RIGHTS_REVIEW',
    certification:'NOT_CERTIFIED',masterReady:false,publishingAllowed:false,publishingLocked:true,
    paidGenerationCreditsUsed:0,generatedAt:new Date().toISOString(),
   }
   await s3.send(new PutObjectCommand({Bucket:process.env.BUCKET,
    Key:(reviewPreview?'internal/unreviewed-narrated-short-reviews/v1/':
     'internal/narrated-short-reviews/v1/')+id+'.json',Body:JSON.stringify(result,null,2),
    ContentType:'application/json',CacheControl:'private, no-store'}))
   if(reviewPreview)await s3.send(new PutObjectCommand({
    Bucket:process.env.BUCKET,Key:previewLatestKey,Body:JSON.stringify(result,null,2),
    ContentType:'application/json',CacheControl:'private, no-store'}))
   console.log(reviewPreview?'CHRISTIAN_PRIVATE_SHORT_PREVIEW_READY':
    'CHRISTIAN_NARRATED_59_SECOND_DRAFT_RESULT',JSON.stringify({
    id,masterHash:result.masterHash,mediaUrl:result.mediaUrl,voiceover:true,captionsPresent:true,
    sourceClips:selected.length,fullDecodePassed:true,certification:'NOT_CERTIFIED',
    publishingAllowed:false}))
   return result
  }finally{await fs.rm(dir,{recursive:true,force:true}).catch(()=>{})}
 })()
 try{return await active}finally{active=null}
}
