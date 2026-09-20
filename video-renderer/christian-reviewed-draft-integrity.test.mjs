import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectCurrentReviewedShortDraft,inspectCurrentReviewedLongDraft,inspectCurrentPrivatePreview} from './christian-reviewed-draft-integrity.mjs'
const hash=i=>i.toString(16).padStart(64,'0')
const source=i=>({id:i,videoSha256:hash(i),visualReviewedVideoSha256:hash(i),
 visualChristianEditorialStatus:'APPROVED_CHRISTIAN_STORY_FIT',
 visualReviewBasis:'HUMAN_FULL_SOURCE_WATCH',
 christianScriptureOrPrayerVisualVerified:true,
 hasConflictingReligiousTextOrRitual:false,bookInScene:false})
const manifest=()=>({collection:'BE_STILL_PEXELS_V1',formatId:'SHORT_59',
 sourceBankReady:true,christianVisualEditorialReady:true,
 assets:Array.from({length:9},(_,i)=>source(i+1))})
const draft=m=>({masterHash:hash(99),unreviewedSourcePreview:false,
 sourceReviewRequired:false,publishingAllowed:false,masterReady:false,
 measured:{fullDecodePassed:true},voiceover:true,captionsPresent:true,
 sourceScenes:m.assets.map(s=>({id:s.id,sourceVideoHash:s.videoSha256}))})
test('current exact nine-source reviewed draft is available for independent review only',()=>{
 const m=manifest(),d=draft(m),r=inspectCurrentReviewedShortDraft(d,m)
 assert.equal(r.ready,true)
 assert.equal(r.publishingAllowed,false)
 assert.equal(r.certified,false)
})
test('later human rejection immediately hides the old reviewed draft',()=>{
 const m=manifest(),d=draft(m)
 m.assets[3].visualChristianEditorialStatus='REJECTED_CHRISTIAN_STORY_FIT'
 assert.equal(inspectCurrentReviewedShortDraft(d,m).ready,false)
})
test('replacement with another MP4 under the same source id invalidates old draft',()=>{
 const m=manifest(),d=draft(m)
 m.assets[4].videoSha256=hash(123)
 m.assets[4].visualReviewedVideoSha256=hash(123)
 assert.match(inspectCurrentReviewedShortDraft(d,m).blockers.join(','),/REVOKED_OR_CHANGED/)
})
test('same sources in a different timeline order cannot inherit the old review',()=>{
 const m=manifest(),d=draft(m)
 ;[m.assets[0],m.assets[1]]=[m.assets[1],m.assets[0]]
 assert.equal(inspectCurrentReviewedShortDraft(d,m).ready,false)
})
test('missing source, forged approval, duplicate or unreviewed preview cannot pass',()=>{
 const m=manifest(),d=draft(m)
 assert.equal(inspectCurrentReviewedShortDraft({...d,unreviewedSourcePreview:true},m).ready,false)
 assert.equal(inspectCurrentReviewedShortDraft({...d,sourceScenes:[...d.sourceScenes.slice(0,8),d.sourceScenes[0]]},m).ready,false)
 m.assets[5].visualReviewBasis='STOCK_METADATA_ONLY'
 assert.equal(inspectCurrentReviewedShortDraft(d,m).ready,false)
})

test('private preview is still reviewable before any visual decisions',()=>{
 const m=manifest(),p={...draft(m),unreviewedSourcePreview:true,sourceReviewRequired:true}
 assert.equal(inspectCurrentPrivatePreview(p,m).ready,true)
})
test('rejecting a scene immediately quarantines its older private preview',()=>{
 const m=manifest(),p={...draft(m),unreviewedSourcePreview:true,sourceReviewRequired:true}
 m.assets[2].reviewStatus='REJECTED_CHRISTIAN_STORY_FIT'
 assert.equal(inspectCurrentPrivatePreview(p,m).ready,false)
})
test('replaced source or missing scene invalidates private preview',()=>{
 const m=manifest(),p={...draft(m),unreviewedSourcePreview:true,sourceReviewRequired:true}
 m.assets[0].videoSha256=hash(456)
 assert.equal(inspectCurrentPrivatePreview(p,m).ready,false)
 assert.equal(inspectCurrentPrivatePreview({...p,sourceScenes:p.sourceScenes.slice(1)},manifest()).ready,false)
})

const longManifest=()=>({collection:'YOUTUBE_WORSHIP_LANDSCAPE_V1',formatId:'YOUTUBE_LONG',
 sourceBankReady:true,christianVisualEditorialReady:true,
 assets:Array.from({length:24},(_,i)=>source(i+100))})
const longDraft=m=>({profileId:'YOUTUBE_LONG',masterHash:hash(777),
 publishingAllowed:false,masterReady:false,voiceover:true,onScreenWords:true,
 voiceSeconds:120,measured:{fullDecodePassed:true,durationSeconds:240},
 sourceScenes:m.assets.map(s=>({stockId:'pexels-'+s.id,sourceVideoHash:s.videoSha256}))})
test('reviewed long-form draft is reviewable only after all 24 actual source decisions',()=>{
 const m=longManifest(),r=inspectCurrentReviewedLongDraft(longDraft(m),m)
 assert.equal(r.ready,true)
 assert.equal(r.publishingAllowed,false)
 assert.equal(r.certified,false)
})
test('long-form audio, duration and final source bytes remain mandatory',()=>{
 const m=longManifest(),d=longDraft(m)
 assert.equal(inspectCurrentReviewedLongDraft({...d,voiceSeconds:0},m).ready,false)
 assert.equal(inspectCurrentReviewedLongDraft({...d,measured:{...d.measured,durationSeconds:18}},m).ready,false)
 m.assets[12].videoSha256=hash(500)
 m.assets[12].visualReviewedVideoSha256=hash(500)
 assert.equal(inspectCurrentReviewedLongDraft(d,m).ready,false)
})
test('long-form rejection, duplicate scene or no human review invalidates the old draft',()=>{
 const m=longManifest(),d=longDraft(m)
 m.assets[5].visualChristianEditorialStatus='REJECTED_CHRISTIAN_STORY_FIT'
 assert.equal(inspectCurrentReviewedLongDraft(d,m).ready,false)
 m.assets[5].visualChristianEditorialStatus='APPROVED_CHRISTIAN_STORY_FIT'
 assert.equal(inspectCurrentReviewedLongDraft({...d,sourceScenes:[...d.sourceScenes.slice(0,23),d.sourceScenes[0]]},m).ready,false)
 m.assets[8].visualReviewBasis='STOCK_METADATA_ONLY'
 assert.equal(inspectCurrentReviewedLongDraft(d,m).ready,false)
})
