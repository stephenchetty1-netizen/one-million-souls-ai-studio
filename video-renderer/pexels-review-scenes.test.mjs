import test from 'node:test'
import assert from 'node:assert/strict'
import { planVisualStory,inspectVisualStoryboard,stockSelectionForBeat } from './visual-storyboard.mjs'
import { buildPexelsReviewStoryboard,createPexelsReviewScene } from './pexels-review-scenes.mjs'
const script='Not every battle is won by doing more. Psalm 46:10 calls us to be still and know that God is God. Make space today to stop the noise, pray, listen, and remember who is truly in control. Stillness is not giving up. It is choosing to trust God instead of letting panic lead you.'
test('review storyboard is original devotional sequence and not publication approval',()=>{
 const p=buildPexelsReviewStoryboard(planVisualStory({title:'BE STILL',script}),'BE_STILL_PEXELS_V1')
 assert.deepEqual(p.beats.map(b=>b.stockId),['pexels-5206028','pexels-5206029','pexels-5206136'])
 assert.deepEqual(p.beats.map(b=>b.stage),['TENSION','SCRIPTURE','RESPONSE'])
 assert.equal(p.humanPerceptualReviewRequired,true)
 assert.equal(p.publishingLocked,true)
 assert.equal(stockSelectionForBeat(p,1).stockId,'pexels-5206029')
})
test('selection and technical storyboard pass never authorize publication',()=>{
 const p=buildPexelsReviewStoryboard(planVisualStory({title:'BE STILL',script}),'BE_STILL_PEXELS_V1')
 const scenes=p.beats.map((beat,i)=>({
  local:'/tmp/review-'+i+'.mp4',source:'rights-cleared-stock-video',
  stockId:beat.stockId,startSeconds:0,
  sourcePage:'https://www.pexels.com/video/a-man-praying-5206028/',
  license:'Pexels License',rightsNote:'Pexels contributor attribution',
 }))
 const r=inspectVisualStoryboard(p,scenes)
 assert.equal(r.passed,true)
 assert.equal(r.publishingAuthority,false)
})
test('unapproved title or collection cannot access staged clips',()=>{
 assert.throws(()=>buildPexelsReviewStoryboard(planVisualStory({title:'DO NOT CARRY TOMORROW',script}),'BE_STILL_PEXELS_V1'),/NOT_AUTHORIZED/)
 assert.throws(()=>buildPexelsReviewStoryboard(planVisualStory({title:'BE STILL',script}),'OTHER'),/NOT_AUTHORIZED/)
})
test('wrong beat and scene index fails before any private S3 access',async()=>{
 await assert.rejects(
  createPexelsReviewScene({collection:'BE_STILL_PEXELS_V1',index:1,seconds:6,work:'/tmp',selection:{stockId:'pexels-5206028',stage:'SCRIPTURE'}}),
  /NOT_CURATED/)
})
