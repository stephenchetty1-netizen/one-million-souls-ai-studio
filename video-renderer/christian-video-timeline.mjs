import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {GetObjectCommand} from '@aws-sdk/client-s3'
import {requireChristianVideoFormat} from './christian-video-formats.mjs'
import {christianVisualSourceReviewed} from './christian-visual-editorial-gate.mjs'

const execFileAsync=promisify(execFile)
const LIMIT=180*1024*1024
const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
export function verifyChristianVideoSceneMetadata(source,formatId,collection){
 const profile=requireChristianVideoFormat(formatId)
 const prefix='internal/pexels-source-candidates/v1/'+collection+'/'
 const portrait=profile.orientation==='portrait'
 if(!source||!Number.isInteger(Number(source.id))||
    String(source.sourceObjectKey||'').startsWith(prefix)===false||
    !String(source.sourceObjectKey||'').endsWith('.mp4')||
    source.license!=='Pexels License'||
    !/^https:\/\/www\.pexels\.com\/video\//.test(String(source.pageUrl||''))||
    !/^[a-f0-9]{64}$/i.test(String(source.videoSha256||''))||
    !['AWAITING_SOURCE_VISUAL_REVIEW','APPROVED_CHRISTIAN_STORY_FIT'].includes(source.reviewStatus)||
    (source.reviewStatus==='APPROVED_CHRISTIAN_STORY_FIT'&&!christianVisualSourceReviewed(source))||
    !String(source.sourceObjectKey).split('/').pop().startsWith(String(source.id)+'-')||
    Number(source.width)<profile.width||Number(source.height)<profile.height||
    (portrait?Number(source.height)<=Number(source.width):Number(source.width)<=Number(source.height))||
    !(Number(source.durationSeconds)>=profile.secondsPerScene+0.25))
   throw new Error('CHRISTIAN_VIDEO_NATIVE_PEXELS_SOURCE_BLOCKED')
 return {profile,prefix}
}
export async function createChristianVideoTimelineScene({store,bucket,source,formatId,collection,index,work}){
 const {profile}=verifyChristianVideoSceneMetadata(source,formatId,collection)
 if(!store||!bucket||!work||!Number.isInteger(index)||index<0||
    index>=profile.minimumDistinctClips)
   throw new Error('CHRISTIAN_VIDEO_SCENE_ARGUMENTS_INVALID')
 const response=await store.send(new GetObjectCommand({Bucket:bucket,Key:source.sourceObjectKey}))
 if(Number(response.ContentLength||0)>LIMIT)throw new Error('CHRISTIAN_VIDEO_SOURCE_TOO_LARGE')
 const b=Buffer.from(await response.Body.transformToByteArray())
 if(b.length<100000||b.length>LIMIT||sha(b)!==source.videoSha256)
   throw new Error('CHRISTIAN_VIDEO_SOURCE_BYTES_OR_HASH_INVALID')
 const original=path.join(work,'timeline-source-'+index+'.mp4')
 const output=path.join(work,'timeline-scene-'+index+'.mp4')
 await fs.writeFile(original,b)
 const {stdout}=await execFileAsync('ffprobe',['-v','error','-show_entries',
   'format=duration:stream=codec_type,width,height','-of','json',original],
   {timeout:30000,maxBuffer:2*1024*1024})
 const info=JSON.parse(stdout)
 const v=info.streams?.find(x=>x.codec_type==='video')
 const duration=Number(info.format?.duration)
 if(!v||v.width!==source.width||v.height!==source.height||
    !Number.isFinite(duration)||duration<profile.secondsPerScene+0.35)
   throw new Error('CHRISTIAN_VIDEO_SOURCE_REAL_DIMENSIONS_OR_LENGTH_FAILED: '+
     JSON.stringify({sourceId:source.id,sourceSlot:source.sourceSlot,
       formatId,sceneIndex:index,advertisedWidth:source.width,
       advertisedHeight:source.height,realWidth:v?.width||null,
       realHeight:v?.height||null,realDurationSeconds:duration,
       requiredSeconds:profile.secondsPerScene+0.35}))
 const vf=`scale=${profile.width}:${profile.height}:force_original_aspect_ratio=increase,crop=${profile.width}:${profile.height},fps=${profile.fps},eq=contrast=1.02:saturation=1.02`
 await execFileAsync('ffmpeg',['-y','-hide_banner','-loglevel','error',
   '-ss','0.1','-i',original,'-t',String(profile.secondsPerScene),
   '-an','-filter_threads','1','-vf',vf,
   '-c:v','libx264','-threads','2','-preset','veryfast','-crf','18',
   '-pix_fmt','yuv420p','-movflags','+faststart',output],
   {timeout:150000,maxBuffer:5*1024*1024})
 if((await fs.stat(output)).size<100000)
   throw new Error('CHRISTIAN_VIDEO_TIMELINE_SCENE_TOO_SMALL')
 return {local:output,source:'rights-cleared-stock-video',
   stockId:'pexels-'+source.id,sourcePage:source.pageUrl,
   license:source.license,sourceVideoHash:source.videoSha256,
   pexelsContributor:source.creator,beatStage:source.beat||null,
   rightsNote:'Pexels licensed source; preview only; human model/rights and visual continuity review required',
   durationSeconds:profile.secondsPerScene}
}
