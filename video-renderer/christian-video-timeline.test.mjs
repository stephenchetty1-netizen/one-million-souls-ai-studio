import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyChristianVideoSceneMetadata} from './christian-video-timeline.mjs'
function source({id=5206028,width=1080,height=1920,durationSeconds=12,collection='BE_STILL_PEXELS_V1',...rest}={}){
 return {id,width,height,durationSeconds,
  sourceObjectKey:'internal/pexels-source-candidates/v1/'+collection+'/'+id+'-900.mp4',
  pageUrl:'https://www.pexels.com/video/a-man-praying-'+id+'/',
  license:'Pexels License',videoSha256:'a'.repeat(64),
  reviewStatus:'AWAITING_SOURCE_VISUAL_REVIEW',...rest}
}
test('native short portrait scene permits cached verified Pexels source',()=>{
 const result=verifyChristianVideoSceneMetadata(source(),'SHORT_59','BE_STILL_PEXELS_V1')
 assert.equal(result.profile.durationSeconds,59)
})
test('native long landscape scene requires dedicated landscape source collection',()=>{
 const s=source({width:1920,height:1080,durationSeconds:15,collection:'YOUTUBE_WORSHIP_LANDSCAPE_V1'})
 assert.equal(verifyChristianVideoSceneMetadata(s,'YOUTUBE_LONG','YOUTUBE_WORSHIP_LANDSCAPE_V1').profile.durationSeconds,240)
 assert.throws(()=>verifyChristianVideoSceneMetadata(s,'SHORT_59','BE_STILL_PEXELS_V1'),/SOURCE_BLOCKED/)
})
test('landscape source cannot be passed off as native 1080x1920 reel',()=>{
 assert.throws(()=>verifyChristianVideoSceneMetadata(
   source({width:1920,height:1080}),'SHORT_59','BE_STILL_PEXELS_V1'),/SOURCE_BLOCKED/)
})
test('Pexels source without verifiable rights or source hash is rejected',()=>{
 for(const key of ['license','pageUrl','videoSha256','reviewStatus']){
  assert.throws(()=>verifyChristianVideoSceneMetadata(
    source({[key]:'INVALID'}),'SHORT_59','BE_STILL_PEXELS_V1'),/SOURCE_BLOCKED/)
 }
})
test('source metadata must stay in private collection for matching clip id',()=>{
 assert.throws(()=>verifyChristianVideoSceneMetadata(
   source({sourceObjectKey:'music-video-review-v1/5206028-900.mp4'}),
   'SHORT_59','BE_STILL_PEXELS_V1'),/SOURCE_BLOCKED/)
})
test('source clip must contain enough original motion for one beat',()=>{
 assert.throws(()=>verifyChristianVideoSceneMetadata(
   source({durationSeconds:3}),'SHORT_59','BE_STILL_PEXELS_V1'),/SOURCE_BLOCKED/)
})

test('exact-hash human-reviewed Christian source is eligible for finished timeline render',()=>{
 const base=source()
 const approved=source({
  reviewStatus:'APPROVED_CHRISTIAN_STORY_FIT',
  visualChristianEditorialStatus:'APPROVED_CHRISTIAN_STORY_FIT',
  visualReviewBasis:'HUMAN_FULL_SOURCE_WATCH',
  visualReviewedVideoSha256:base.videoSha256,
  christianScriptureOrPrayerVisualVerified:true,
  bookInScene:true,bookIsBibleVerified:true,
  hasConflictingReligiousTextOrRitual:false,
 })
 assert.equal(verifyChristianVideoSceneMetadata(
  approved,'SHORT_59','BE_STILL_PEXELS_V1').profile.id,'SHORT_59')
})
test('status-only approval and human-rejected clip cannot enter master timeline',()=>{
 const base=source()
 const approved={
  visualChristianEditorialStatus:'APPROVED_CHRISTIAN_STORY_FIT',
  visualReviewBasis:'HUMAN_FULL_SOURCE_WATCH',
  christianScriptureOrPrayerVisualVerified:true,
  bookInScene:false,hasConflictingReligiousTextOrRitual:false,
  reviewStatus:'APPROVED_CHRISTIAN_STORY_FIT',
 }
 assert.throws(()=>verifyChristianVideoSceneMetadata(
  source({...approved,visualReviewedVideoSha256:'b'.repeat(64)}),
  'SHORT_59','BE_STILL_PEXELS_V1'),/SOURCE_BLOCKED/)
 assert.throws(()=>verifyChristianVideoSceneMetadata(
  source({...approved,visualReviewedVideoSha256:base.videoSha256,
   reviewStatus:'REJECTED_CHRISTIAN_STORY_FIT'}),
  'SHORT_59','BE_STILL_PEXELS_V1'),/SOURCE_BLOCKED/)
})
