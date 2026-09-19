import test from 'node:test'
import assert from 'node:assert/strict'
import {
 REVOKED_WORSHIP_MASTERS,REVOKED_WORSHIP_MEDIA_KEYS,
 worshipMasterRevoked,worshipMediaRevoked,christianVisualSourceReviewed,
 christianVisualReviewReadiness
} from './christian-visual-editorial-gate.mjs'
const hash='c8ada286689f9cebb80c6b67e11612e764f6c4f3f2c16ea01d732286e43944e4'
const metadata={
 id:5206028,videoSha256:hash,
 visualReviewedVideoSha256:hash,
 visualReviewBasis:'HUMAN_FULL_SOURCE_WATCH',
 visualChristianEditorialStatus:'APPROVED_CHRISTIAN_STORY_FIT',
 christianScriptureOrPrayerVisualVerified:true,
 bookInScene:true,bookIsBibleVerified:true,
 hasConflictingReligiousTextOrRitual:false,
}
test('user rejected 59s, long form and inherited 18s exact masters',()=>{
 assert.equal(REVOKED_WORSHIP_MASTERS.length,3)
 for(const master of REVOKED_WORSHIP_MASTERS)assert.equal(worshipMasterRevoked(master),true)
 assert.equal(worshipMasterRevoked('not-rejected'),false)
})
test('public rejected video and contact sheet links are withdrawn',()=>{
 assert.equal(REVOKED_WORSHIP_MEDIA_KEYS.length,6)
 for(const key of REVOKED_WORSHIP_MEDIA_KEYS)assert.equal(worshipMediaRevoked(key),true)
 assert.equal(worshipMediaRevoked('music-video-review-v1/SHORT_59/NEW.mp4'),false)
})
test('Pexels search metadata or prayer posture alone never grants Christian editorial approval',()=>{
 assert.equal(christianVisualSourceReviewed({id:5206028,videoSha256:hash,
  searchQuery:'man praying with bible',pageUrl:'https://www.pexels.com/video/example/'}),false)
 assert.equal(christianVisualSourceReviewed({...metadata,visualChristianEditorialStatus:'AWAITING_SOURCE_VISUAL_REVIEW'}),false)
 assert.equal(christianVisualSourceReviewed({...metadata,visualReviewBasis:'AI_SEARCH_KEYWORDS'}),false)
})
test('visible book requires positively verified Bible, not unverified book or unrelated scripture',()=>{
 assert.equal(christianVisualSourceReviewed({...metadata,bookIsBibleVerified:false}),false)
 assert.equal(christianVisualSourceReviewed({...metadata,bookIsBibleVerified:undefined}),false)
 assert.equal(christianVisualSourceReviewed({...metadata,hasConflictingReligiousTextOrRitual:true}),false)
 assert.equal(christianVisualSourceReviewed(metadata),true)
})
test('approval belongs to exact source bytes and fails after source video changes',()=>{
 assert.equal(christianVisualSourceReviewed({...metadata,videoSha256:'a'.repeat(64)}),false)
 assert.equal(christianVisualSourceReviewed({...metadata,visualReviewedVideoSha256:undefined}),false)
})
test('review readiness is editorially blocked despite physically downloaded clips',()=>{
 const report=christianVisualReviewReadiness([
  metadata,{...metadata,id:5206029,visualReviewBasis:undefined}
 ])
 assert.equal(report.reviewedClips,1)
 assert.equal(report.totalClips,2)
 assert.equal(report.pending.length,1)
 assert.equal(report.publishingAllowed,false)
})
