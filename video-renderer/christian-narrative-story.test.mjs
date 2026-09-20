import test from 'node:test'
import assert from 'node:assert/strict'
import {CHRISTIAN_STORY_PLANS,requireChristianStoryPlan,requireNarratedChristianMasterEvidence} from './christian-narrative-story.mjs'

test('59s reel has a distinct Christian Gospel script and nine legible story beats',()=>{
 const plan=requireChristianStoryPlan('SHORT_59')
 const words=plan.voiceScript.split(/\s+/)
 assert.equal(plan.cards.length,9)
 assert.ok(words.length>=95&&words.length<=155,'short Christian narration must occupy a real 59-second story')
 assert.match(plan.voiceScript,/Jesus Christ/)
 assert.match(plan.voiceScript,/John chapter one, verse sixteen/)
 assert.match(plan.voiceScript,/pray|prayer/i)
 assert.ok(plan.cards.some(x=>x.includes('JOHN 1:16')))
 assert.equal(plan.publishingAllowed,false)
})
test('four-minute YouTube piece has a full original Christian story not nine shots stretched',()=>{
 const plan=requireChristianStoryPlan('YOUTUBE_LONG')
 assert.equal(plan.cards.length,24)
 assert.ok(plan.voiceScript.split(/\s+/).length>=370)
 assert.match(plan.voiceScript,/Ephesians chapter two/)
 assert.match(plan.voiceScript,/Psalm forty-six/)
 assert.match(plan.voiceScript,/Jesus Christ/)
 assert.ok(plan.cards.some(x=>x.includes('EPHESIANS')))
 assert.ok(plan.voiceMinSeconds>=140)
 assert.equal(plan.publishingAllowed,false)
})
test('reject silent stock montages, missing text, no voice duration and missing music ducking',()=>{
 const plan=requireChristianStoryPlan('SHORT_59')
 const good={profileId:'SHORT_59',voiceover:true,onScreenWords:true,
  musicUnderNarration:true,voiceSeconds:44,textCardCount:plan.cards.length,
  editorialStatus:'AWAITING_FULL_AUDIOVISUAL_AND_RIGHTS_REVIEW'}
 assert.equal(requireNarratedChristianMasterEvidence(good),true)
 for(const change of [{voiceover:false},{onScreenWords:false},{musicUnderNarration:false},
   {voiceSeconds:15},{voiceSeconds:59},{textCardCount:3},
   {editorialStatus:'APPROVED_AWAITING_POST_TIME'}]){
  assert.throws(()=>requireNarratedChristianMasterEvidence({...good,...change}),
    /SILENT_OR_UNAPPEALING_CHRISTIAN_MONTAGE_REJECTED/)
 }
})
test('long form needs actual narration rather than a four-minute silent hymn',()=>{
 const plan=requireChristianStoryPlan('YOUTUBE_LONG')
 const sample={profileId:'YOUTUBE_LONG',voiceover:true,onScreenWords:true,
  musicUnderNarration:true,voiceSeconds:185,textCardCount:plan.cards.length,
  editorialStatus:'AWAITING_FULL_AUDIOVISUAL_AND_RIGHTS_REVIEW'}
 assert.equal(requireNarratedChristianMasterEvidence(sample),true)
 assert.throws(()=>requireNarratedChristianMasterEvidence({...sample,voiceSeconds:50}),
  /SILENT_OR_UNAPPEALING_CHRISTIAN_MONTAGE_REJECTED/)
})
test('no synthetic source approval or missing format accepted',()=>{
 assert.throws(()=>requireChristianStoryPlan('LEGACY_18'),/REQUIRED/)
 assert.throws(()=>requireNarratedChristianMasterEvidence({}),/SILENT_OR_UNAPPEALING/)
})
