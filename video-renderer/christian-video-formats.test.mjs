import test from 'node:test'
import assert from 'node:assert/strict'
import {CHRISTIAN_VIDEO_FORMATS,requireChristianVideoFormat,inspectChristianVideoSources,
requireChristianVideoSources} from './christian-video-formats.mjs'
function video(i,width,height,durationSeconds){
 return {id:i,width,height,durationSeconds,license:'Pexels License',
   pageUrl:'https://www.pexels.com/video/example-'+i+'/'}
}
test('short reels use 59 seconds, native portrait and 9 different clips',()=>{
 const p=CHRISTIAN_VIDEO_FORMATS.SHORT_59
 assert.equal(p.durationSeconds,59)
 assert.deepEqual([p.width,p.height,p.fps],[1080,1920,30])
 assert.equal(p.minimumDistinctClips,9)
 assert.deepEqual(p.platforms,['TikTok','Instagram Reels','YouTube Shorts'])
 assert.equal(p.publishingAllowed,false)
})
test('YouTube long form has its own 4-minute native landscape production',()=>{
 const p=CHRISTIAN_VIDEO_FORMATS.YOUTUBE_LONG
 assert.equal(p.durationSeconds,240)
 assert.deepEqual([p.width,p.height,p.fps],[1920,1080,30])
 assert.equal(p.minimumDistinctClips,24)
 assert.equal(p.publishingAllowed,false)
})
test('three known Pexels portrait shots cannot be looped to fake a 59-second reel',()=>{
 const existing=[video(5206028,1080,1920,12),video(5206029,1080,1920,12),
 video(5206136,1080,1920,12)]
 const readiness=inspectChristianVideoSources('SHORT_59',existing,300)
 assert.equal(readiness.readyForDraftRender,false)
 assert.match(readiness.blockers.join(';'),/NOT_ENOUGH_DISTINCT_VISUAL_SHOTS_3_OF_9/)
 assert.throws(()=>requireChristianVideoSources('SHORT_59',existing,300),/SOURCES_BLOCKED/)
})
test('nine portrait sources pass short-form editorial source gate with long enough music',()=>{
 const clips=Array.from({length:9},(_,i)=>video(i+1,1080,1920,8))
 const r=inspectChristianVideoSources('SHORT_59',clips,100)
 assert.equal(r.readyForDraftRender,true)
 assert.equal(r.publishingAllowed,false)
 assert.equal(r.sourceReviewRequired,true)
})
test('24 native landscape clips plus full soundtrack required for YouTube',()=>{
 const clips=Array.from({length:24},(_,i)=>video(i+1,1920,1080,12))
 assert.equal(inspectChristianVideoSources('YOUTUBE_LONG',clips,242).readyForDraftRender,true)
 assert.match(inspectChristianVideoSources('YOUTUBE_LONG',clips,200).blockers.join(';'),
   /LICENSED_MUSIC_TOO_SHORT/)
 assert.match(inspectChristianVideoSources('YOUTUBE_LONG',
   clips.map(x=>({...x,width:1080,height:1920})),242).blockers.join(';'),
   /NATIVE_LANDSCAPE_LICENSED_SHOTS_0_OF_24/)
})
test('portrait video artificially stretched to landscape is not allowed',()=>{
 const clips=Array.from({length:24},(_,i)=>video(i+1,1080,1920,18))
 assert.equal(inspectChristianVideoSources('YOUTUBE_LONG',clips,400).readyForDraftRender,false)
})
test('missing licence, duplicates or too-short footage prevent a fake edit',()=>{
 const clips=Array.from({length:9},(_,i)=>video(i+1,1080,1920,8))
 assert.equal(inspectChristianVideoSources('SHORT_59',
   clips.map(x=>({...x,id:1})),61).readyForDraftRender,false)
 assert.equal(inspectChristianVideoSources('SHORT_59',
   clips.map(x=>({...x,license:'UNVERIFIED'})),61).readyForDraftRender,false)
 assert.equal(inspectChristianVideoSources('SHORT_59',
   clips.map(x=>({...x,durationSeconds:3})),61).readyForDraftRender,false)
})
test('unknown formats cannot silently fall back to old 18-second export',()=>{
 assert.throws(()=>requireChristianVideoFormat('MUSIC_LED_SHORT'),/NOT_SUPPORTED/)
 assert.throws(()=>requireChristianVideoFormat('LEGACY_18'),/NOT_SUPPORTED/)
})
