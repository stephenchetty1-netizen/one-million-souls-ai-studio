import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { PEXELS_COLLECTIONS } from './pexels-source-import.mjs'

const execFileAsync=promisify(execFile)
const STORAGE_PREFIX='internal/pexels-source-candidates/v1'
const WIDTH=Number(process.env.RENDER_WIDTH||1080)
const HEIGHT=Number(process.env.RENDER_HEIGHT||1920)
const FPS=Number(process.env.RENDER_FPS||30)
const MAX_SOURCE_BYTES=180*1024*1024
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex')
const s3=()=>new S3Client({
  endpoint:process.env.ENDPOINT,region:process.env.REGION,forcePathStyle:true,
  credentials:{accessKeyId:process.env.ACCESS_KEY_ID,secretAccessKey:process.env.SECRET_ACCESS_KEY},
})
async function readObject(store,key,maxBytes=MAX_SOURCE_BYTES){
  const r=await store.send(new GetObjectCommand({Bucket:process.env.BUCKET,Key:key}))
  const advertised=Number(r.ContentLength||0)
  if(advertised>maxBytes)throw new Error('PEXELS_PRIVATE_SOURCE_TOO_LARGE')
  const body=Buffer.from(await r.Body.transformToByteArray())
  if(body.length>maxBytes||body.length===0)throw new Error('PEXELS_PRIVATE_SOURCE_INVALID_SIZE')
  return body
}
export function buildPexelsReviewStoryboard(plan,collection){
  if(collection!=='BE_STILL_PEXELS_V1'||plan?.title!=='BE STILL'||!Array.isArray(plan.beats)||plan.beats.length!==3)
    throw new Error('PEXELS_REVIEW_STORYBOARD_NOT_AUTHORIZED')
  const selected=PEXELS_COLLECTIONS[collection]
  if(!selected||selected.length!==3)throw new Error('PEXELS_REVIEW_EXACTLY_THREE_BEATS_REQUIRED')
  return {...plan,stockStoryboardAvailable:true,publishingLocked:true,humanPerceptualReviewRequired:true,
    beats:plan.beats.map((beat,index)=>({
      ...beat,stockId:'pexels-'+selected[index].id,startSeconds:0,repriseOf:undefined,
      meaning:selected[index].intent
    }))
  }
}
export async function createPexelsReviewScene({collection,index,work,seconds,selection}){
  const shot=PEXELS_COLLECTIONS[collection]?.[index]
  if(!shot||collection!=='BE_STILL_PEXELS_V1'||!selection||
    selection.stockId!=='pexels-'+shot.id||selection.stage!==shot.beat)
    throw new Error('PEXELS_REVIEW_SCENE_NOT_CURATED')
  if(!Number.isFinite(seconds)||seconds<4||seconds>12)
    throw new Error('PEXELS_REVIEW_SCENE_DURATION_INVALID')
  if(!process.env.BUCKET||!process.env.ENDPOINT||!process.env.ACCESS_KEY_ID||!process.env.SECRET_ACCESS_KEY)
    throw new Error('PEXELS_REVIEW_PRIVATE_STORAGE_REQUIRED')
  const store=s3()
  const metadataKey=`${STORAGE_PREFIX}/${collection}/${shot.id}.json`
  const metadata=JSON.parse((await readObject(store,metadataKey,100000)).toString('utf8'))
  const requiredPrefix=`${STORAGE_PREFIX}/${collection}/${shot.id}-`
  if(metadata?.id!==shot.id||metadata?.reviewStatus!=='AWAITING_SOURCE_VISUAL_REVIEW'||
     !metadata?.sourceObjectKey?.startsWith(requiredPrefix)||!metadata.sourceObjectKey.endsWith('.mp4')||
     metadata.width<1080||metadata.height<1920||metadata.width>=metadata.height||
     metadata.license!=='Pexels License'||!/^https:\/\/www\.pexels\.com\/video\//.test(metadata.pageUrl||''))
    throw new Error('PEXELS_REVIEW_SOURCE_PROVENANCE_BLOCK')
  const bytes=await readObject(store,metadata.sourceObjectKey)
  if(sha(bytes)!==metadata.videoSha256)throw new Error('PEXELS_REVIEW_SOURCE_HASH_MISMATCH')
  const original=path.join(work,`pexels-source-${shot.id}.mp4`)
  const output=path.join(work,`pexels-review-scene-${index+1}.mp4`)
  await fs.writeFile(original,bytes)
  const {stdout}=await execFileAsync('ffprobe',[
    '-v','error','-show_entries','format=duration:stream=codec_type,width,height',
    '-of','json',original,
  ],{timeout:30000,maxBuffer:2*1024*1024})
  const info=JSON.parse(stdout)
  const stream=info.streams?.find(x=>x.codec_type==='video')
  const duration=Number(info.format?.duration)
  if(!stream||stream.width<1080||stream.height<1920||stream.width>=stream.height||
     !Number.isFinite(duration)||duration<seconds+0.2)
    throw new Error('PEXELS_REVIEW_SOURCE_TOO_SHORT_OR_NOT_NATIVE_PORTRAIT')
  await execFileAsync('ffmpeg',[
    '-y','-ss','0.1','-i',original,'-t',seconds.toFixed(3),'-an',
    '-filter_threads','1',
    '-vf',`scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},fps=${FPS},eq=contrast=1.025:saturation=1.025:gamma=1.015`,
    '-c:v','libx264','-preset','veryfast','-crf','18','-threads','2',
    '-pix_fmt','yuv420p','-movflags','+faststart',output,
  ],{timeout:150000,maxBuffer:8*1024*1024})
  if((await fs.stat(output)).size<100000)throw new Error('PEXELS_REVIEW_INVALID_EDIT')
  return {
    local:output,source:'rights-cleared-stock-video',stockId:selection.stockId,
    startSeconds:0,beatStage:selection.stage,storyboardVersion:selection.storyboardVersion,
    visualMeaning:selection.meaning,repriseOf:null,
    sourcePage:metadata.pageUrl,license:metadata.license,
    rightsNote:metadata.attribution+'; '+metadata.licenseUrl+
      '; editorial preview, no endorsement implied; rights and model review pending.',
    pexelsContributor:metadata.creator,sourceVideoHash:metadata.videoSha256,
  }
}
