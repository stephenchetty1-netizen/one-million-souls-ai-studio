import test from 'node:test'
import assert from 'node:assert/strict'
import {CHRISTIAN_PEXELS_STORY,requireFormatPlan,
  selectPexelsRendition,searchSlots,validateMeasuredPexelsVideo,conflictingFaithSourceMetadata,rejectUnusableOpeningScene} from './pexels-format-library.mjs'
const videoFiles=(items)=>({video_files:items.map((x,i)=>({
  id:100+i,file_type:'video/mp4',quality:'hd',
  width:x[0],height:x[1],fps:30,
  link:'https://videos.pexels.com/video-files/100/100-hd.mp4'
}))})
test('59s plan adds six source searches to three legacy unapproved candidate IDs',()=>{
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

test('both discovery formats prefer specific Christian symbols over generic prayer or generic books',()=>{
 const all=[...searchSlots('SHORT_59'),...searchSlots('YOUTUBE_LONG')]
 assert.equal(all.length,30)
 assert.ok(all.every(x=>/cross|crucifix|church|bible|gospel|jesus|chapel|scripture/.test(x.query)))
 assert.ok(all.every(x=>!/^(hands praying|prayer book|christian prayer|bible reading|sunrise mountains|forest sunlight)$/.test(x.query)))
})
test('obvious contradictory page metadata is skipped but appearance and attire never determine religion',()=>{
 assert.equal(conflictingFaithSourceMetadata({url:'https://www.pexels.com/video/a-mosque-worship-12345/'}),true)
 assert.equal(conflictingFaithSourceMetadata({url:'https://www.pexels.com/video/hindu-puja-12345/'}),true)
 assert.equal(conflictingFaithSourceMetadata({url:'https://www.pexels.com/video/a-quran-reading-12345/'}),true)
 assert.equal(conflictingFaithSourceMetadata({url:'https://www.pexels.com/video/church-cross-12345/'}),false)
 assert.equal(conflictingFaithSourceMetadata({url:'https://www.pexels.com/video/man-white-cap-orange-shirt-12345/'}),false)
 assert.equal(conflictingFaithSourceMetadata({url:'https://www.pexels.com/video/praying-12345/'}),false)
})

test('real FFmpeg blackdetect rejects predominantly blank preview scene, not brief fades',()=>{
 assert.throws(()=>rejectUnusableOpeningScene(
  '[blackdetect @ 0x12] black_start:0 black_end:5.8 black_duration:5.8',59/9),
  /PEXELS_SOURCE_BLANK_OPENING_SCENE/)
 assert.deepEqual(rejectUnusableOpeningScene(
  '[blackdetect @ 0x12] black_start:0 black_end:0.5 black_duration:0.5',59/9),
  {ok:true,blankOrFreezeRejected:false})
})
test('real FFmpeg freezedetect rejects completed long frozen footage',()=>{
 assert.throws(()=>rejectUnusableOpeningScene(
  '[freezedetect @ 0x9] lavfi.freezedetect.freeze_start: 0\n' +
  '[freezedetect @ 0x9] lavfi.freezedetect.freeze_duration: 6\n' +
  '[freezedetect @ 0x9] lavfi.freezedetect.freeze_end: 6',59/9),
  /PEXELS_SOURCE_FROZEN_OPENING_SCENE/)
})
test('real FFmpeg freezedetect rejects scene frozen through the end of the clip',()=>{
 assert.throws(()=>rejectUnusableOpeningScene(
  '[freezedetect @ 0x9] lavfi.freezedetect.freeze_start: 0',59/9),
  /PEXELS_SOURCE_FROZEN_OPENING_SCENE/)
 assert.deepEqual(rejectUnusableOpeningScene(
  '[freezedetect @ 0x9] lavfi.freezedetect.freeze_start: 5.9',59/9),
  {ok:true,blankOrFreezeRejected:false})
})
