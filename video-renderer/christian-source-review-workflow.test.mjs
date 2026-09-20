import test from 'node:test'
import assert from 'node:assert/strict'
import {validateHumanSourceReview} from './christian-source-review-workflow.mjs'
import {christianVisualSourceReviewed} from './christian-visual-editorial-gate.mjs'

const source={id:5206028,videoSha256:'a'.repeat(64)}
const complete={id:5206028,sourceVideoHash:source.videoSha256,decision:'APPROVE',
 attestation:'I_WATCHED_ENTIRE_EXACT_SOURCE_VIDEO',reviewer:'Stephen',
 notes:'The full clip depicts verified Christian prayer and Scripture.',
 christianScriptureOrPrayerVisualVerified:true,bookInScene:true,bookIsBibleVerified:true,
 hasConflictingReligiousTextOrRitual:false}
test('exact watched and verified Christian source passes strict input preflight',()=>{
 const v=validateHumanSourceReview(source,complete)
 assert.equal(v.decision,'APPROVE')
 assert.equal(v.bookIsBibleVerified,true)
})
test('source cannot be approved from Pexels search metadata alone',()=>{
 assert.throws(()=>validateHumanSourceReview(source,{...complete,attestation:undefined}),
  /FULL_EXACT_SOURCE_WATCH_ATTESTATION_REQUIRED/)
 assert.throws(()=>validateHumanSourceReview(source,{...complete,sourceVideoHash:'b'.repeat(64)}),
  /EXACT_SOURCE_SHA256_REQUIRED/)
})
test('wrong or unverified religious imagery fails approved source preflight',()=>{
 assert.throws(()=>validateHumanSourceReview(source,{...complete,bookIsBibleVerified:false}),
  /CHRISTIAN_SCENE_CONTENT_NOT_CONFIRMED/)
 assert.throws(()=>validateHumanSourceReview(source,{...complete,christianScriptureOrPrayerVisualVerified:false}),
  /CHRISTIAN_SCENE_CONTENT_NOT_CONFIRMED/)
 assert.throws(()=>validateHumanSourceReview(source,{...complete,hasConflictingReligiousTextOrRitual:true}),
  /CHRISTIAN_SCENE_CONTENT_NOT_CONFIRMED/)
})
test('explicit rejection remains possible for visibly unsuitable footage',()=>{
 const v=validateHumanSourceReview(source,{...complete,decision:'REJECT',
 christianScriptureOrPrayerVisualVerified:false,bookIsBibleVerified:false,
 hasConflictingReligiousTextOrRitual:true})
 assert.equal(v.decision,'REJECT')
 assert.equal(v.conflicting,true)
})
test('reject fake clearance without a reviewed exact-source SHA',()=>{
 assert.equal(christianVisualSourceReviewed({...source,...complete,
 visualChristianEditorialStatus:'APPROVED_CHRISTIAN_STORY_FIT',
 visualReviewBasis:'HUMAN_FULL_SOURCE_WATCH',visualReviewedVideoSha256:'b'.repeat(64)}),false)
})
