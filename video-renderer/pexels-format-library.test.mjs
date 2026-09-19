import test from 'node:test'
import assert from 'node:assert/strict'
import {CHRISTIAN_PEXELS_STORY,requireFormatPlan,
  selectPexelsRendition,searchSlots,validateMeasuredPexelsVideo} from './pexels-format-library.mjs'
const videoFiles=(items)=>({video_files:items.map((x,i)=>({
  id:100+i,file_type:'video/mp4',quality:'hd',
  width:x[0],height:x[1],fps:30,
  link:'https://videos.pexels.com/video-files/100/100-hd.mp4'
}))})
test('59s portrait plan adds six story beats to three previously verified shots',()=>{
 const plan=requireFormatPlan('SHORT_59')
 assert.deepEqual(plan.plan.base,[5206028,5206029,5206136])
 assert.equal(searchSlots('SHORT_59').length,6)
 assert.equal(searchSlots('SHORT_59').length+plan.plan.base.length,9)
 assert.equal(plan.profile.durationSeconds,59)
})
test('long YouTube plan uses 24 distinct source slots with deliberate search intent',()=>{
 const plan=requireFormatPlan('YOUTUBE_LONG')
 const slots=searchSlots('YOUTUBE_LONG')
 assert.equal(slots.length,24)
 assert.equal(new Set(slots.map(x=>x.id)).size,24)
 assert.equal(plan.profile.durationSeconds,240)
 assert.equal(plan.profile.orientation,'landscape')
 assert.equal(CHRISTIAN_PEXELS_STORY.YOUTUBE_LONG.base.length,0)
})
test('portrait source must be native 1080 by 1920 or larger',()=>{
 assert.equal(selectPexelsRendition(videoFiles([
   [720,1280],[1920,1080],[1080,1920],[2160,3840]
 ]),'SHORT_59').width,1080)
 assert.throws(()=>selectPexelsRendition(videoFiles([[720,1280],[1920,1080]]),'SHORT_59'),
 /PEXELS_NATIVE_PORTRAIT_RENDITION_REQUIRED/)
})
test('landscape source must be native 1920 by 1080 or larger',()=>{
 assert.deepEqual((({width,height})=>({width,height}))(selectPexelsRendition(videoFiles([
  [1280,720],[1920,1080],[3840,2160],[1080,1920]
 ]),'YOUTUBE_LONG')),{width:1920,height:1080})
 assert.throws(()=>selectPexelsRendition(videoFiles([[1280,720],[1080,1920]]),'YOUTUBE_LONG'),
 /PEXELS_NATIVE_LANDSCAPE_RENDITION_REQUIRED/)
})
test('unsupported media hosts cannot become Pexels source media',()=>{
 assert.throws(()=>selectPexelsRendition({
  video_files:[{file_type:'video/mp4',quality:'hd',width:1080,height:1920,
    link:'https://evil.example/video.mp4'}]
 },'SHORT_59'),/PEXELS_NATIVE_PORTRAIT_RENDITION_REQUIRED/)
})
test('search slot formatting fails closed for uncurated content format',()=>{
 assert.throws(()=>searchSlots('LEGACY_18'),/NOT_SUPPORTED/)
})

test('actual portrait video must have native dimensions and enough playable time',()=>{
 const mp4={streams:[{codec_type:'video',width:1080,height:1920}],
   format:{duration:'8.5'}}
 assert.deepEqual(validateMeasuredPexelsVideo(mp4,'SHORT_59'),
   {width:1080,height:1920,durationSeconds:8.5})
 assert.throws(()=>validateMeasuredPexelsVideo({...mp4,format:{duration:'6.7'}},'SHORT_59'),
   /PEXELS_MP4_MEASURED_PROFILE_MISMATCH/)
 assert.throws(()=>validateMeasuredPexelsVideo({...mp4,streams:[{codec_type:'video',width:1920,height:1080}]},'SHORT_59'),
   /PEXELS_MP4_MEASURED_PROFILE_MISMATCH/)
})
test('landscape MP4 real probe must meet 1920x1080 and 10.35 playable seconds',()=>{
 const full={streams:[{codec_type:'video',width:1920,height:1080}],
   format:{duration:'11'}}
 assert.equal(validateMeasuredPexelsVideo(full,'YOUTUBE_LONG').durationSeconds,11)
 assert.throws(()=>validateMeasuredPexelsVideo({...full,format:{duration:'10.2'}},'YOUTUBE_LONG'),
   /PEXELS_MP4_MEASURED_PROFILE_MISMATCH/)
 assert.throws(()=>validateMeasuredPexelsVideo({...full,streams:[{codec_type:'video',width:1280,height:720}]},'YOUTUBE_LONG'),
   /PEXELS_MP4_MEASURED_PROFILE_MISMATCH/)
})
