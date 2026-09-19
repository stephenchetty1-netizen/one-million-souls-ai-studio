import test from 'node:test'
import assert from 'node:assert/strict'
import {
 PEXELS_COLLECTIONS,validatedPexelsVideoUrl,choosePortraitMp4,
 validatePexelsMetadata,stagePexelsCollection,createPexelsPreviewScene,
} from './pexels-source-import.mjs'
const hd=(width,height,fps=30,link='https://videos.pexels.com/video-files/100/100-hd_1080_1920.mp4')=>
 ({id:200,quality:'hd',file_type:'video/mp4',width,height,fps,link})
test('same-contributor devotional uses explicitly selected source pages',()=>{
 assert.deepEqual(PEXELS_COLLECTIONS.BE_STILL_PEXELS_V1.map(x=>x.id),[5206028,5206029,5206136])
 assert.deepEqual(PEXELS_COLLECTIONS.BE_STILL_PEXELS_V1.map(x=>x.beat),['TENSION','SCRIPTURE','RESPONSE'])
})
test('native portrait at least 1080x1920 beats stretched landscape and 720p',()=>{
 const chosen=choosePortraitMp4({video_files:[
  hd(1920,1080),hd(720,1280),hd(1080,1920),hd(2160,3840,25),
 ]})
 assert.equal(chosen.width,2160)
 assert.equal(chosen.height,3840)
})
test('Pexels video metadata may omit frame rate without being rejected',()=>{
 const result=choosePortraitMp4({video_files:[{...hd(1080,1920),fps:undefined}]})
 assert.equal(result.width,1080)
})
test('unsupported or non-portrait videos fail closed',()=>{
 assert.throws(()=>choosePortraitMp4({video_files:[hd(1920,1080),hd(720,1280)]}),/PEXELS_NO_NATIVE_1080X1920_PORTRAIT_MP4/)
})
test('untrusted direct video hosts and HTTP are refused',()=>{
 assert.throws(()=>validatedPexelsVideoUrl('http://videos.pexels.com/video-files/a.mp4'),/DOMAIN_NOT_ALLOWED/)
 assert.throws(()=>validatedPexelsVideoUrl('https://video.example.org/a.mp4'),/DOMAIN_NOT_ALLOWED/)
 assert.match(validatedPexelsVideoUrl('https://player.vimeo.com/external/a.mp4'),/player.vimeo.com/)
})
test('video id, Pexels page and contributor must match the allowlist',()=>{
 const source={id:5206028,url:'https://www.pexels.com/video/a-man-praying-5206028/',user:{name:'Tima Miroshnichenko'}}
 assert.equal(validatePexelsMetadata(source,5206028),source.url)
 assert.throws(()=>validatePexelsMetadata(source,5206029),/VIDEO_ID_MISMATCH/)
 assert.throws(()=>validatePexelsMetadata({...source,user:{}},5206028),/CREATOR_UNKNOWN/)
 assert.throws(()=>validatePexelsMetadata({...source,url:'https://evil.example/video/5206028/'},5206028),/SOURCE_PAGE_INVALID/)
})
test('no API key must fail closed before any network request',async()=>{
 const prior=process.env.PEXELS_API_KEY
 delete process.env.PEXELS_API_KEY
 try{
  await assert.rejects(stagePexelsCollection(),/PEXELS_API_KEY_REQUIRED/)
  await assert.rejects(stagePexelsCollection('UNAPPROVED'),/COLLECTION_NOT_APPROVED/)
 }finally{
  if(prior!==undefined)process.env.PEXELS_API_KEY=prior
 }
})

test('Pexels proof refuses all uncurated topics and invalid scene positions',async()=>{
 await assert.rejects(createPexelsPreviewScene({
  collection:'UNAPPROVED',beatIndex:0,work:'/tmp'
 }),/PEXELS_PREVIEW_COLLECTION_NOT_ALLOWLISTED/)
 await assert.rejects(createPexelsPreviewScene({
  collection:'BE_STILL_PEXELS_V1',beatIndex:4,work:'/tmp'
 }),/PEXELS_PREVIEW_BEAT_INDEX_INVALID/)
})
