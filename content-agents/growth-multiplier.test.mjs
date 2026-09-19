import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyGrowthPost } from './growth-multiplier.mjs'

const tiktok={
  viewsPerVideo:146,
  interactionRatePerViewPercent:11.36,
  netFollowerConversionPerViewPercent:0.318,
}
function metrics(overrides={}){
  return {publishedDate:'2026-09-10',postId:'7684058041024630024',
    views:222,likes:36,comments:5,shares:2,durationSeconds:49,
    averageWatchSeconds:17,...overrides}
}
test('real mature TikTok post with strong views and engagement can be a winner',()=>{
  const out=classifyGrowthPost('tiktok',metrics({ageHours:120}),tiktok)
  assert.equal(out.classification,'WINNER')
  assert.equal(out.signals.retentionIndex,null)
  assert.equal(out.signals.conversionIndex,null)
  assert.equal(out.signals.comparableSignals,2)
})
test('missing watch time and conversion are unknown, never zero',()=>{
  const out=classifyGrowthPost('tiktok',metrics({ageHours:120,averageWatchSeconds:null}),tiktok)
  assert.equal(out.signals.retention,null)
  assert.equal(out.signals.retentionIndex,null)
  assert.equal(out.signals.conversion,null)
  assert.equal(out.signals.conversionIndex,null)
  assert.equal(out.classification,'WINNER')
})
test('many views without other measured comparable signals are not winner',()=>{
  const out=classifyGrowthPost('youtube',{
    postId:'abc',views:5000,ageHours:100,
    likes:100,comments:10,shares:null,averageWatchSeconds:null,
  },{viewsPerUpload:250})
  assert.equal(out.classification,'MEASURE')
  assert.equal(out.signals.engagement,null)
  assert.equal(out.signals.comparableSignals,1)
})
test('a fast start does not classify a post before maturity',()=>{
  const out=classifyGrowthPost('tiktok',metrics({ageHours:2,views:1200,likes:300,comments:30,shares:50}),tiktok)
  assert.equal(out.classification,'AWAIT_DATA')
})
test('published date is required when explicit age is not present',()=>{
  const out=classifyGrowthPost('tiktok',metrics({publishedDate:null,ageHours:null}),tiktok)
  assert.equal(out.classification,'AWAIT_DATA')
  assert.ok(out.signals.missingSignals.includes('PUBLICATION_AGE'))
})
test('strong viewer response and weak reach routes to rescue',()=>{
  const out=classifyGrowthPost('tiktok',metrics({ageHours:72,views:80,likes:22,comments:1,shares:1}),tiktok)
  assert.equal(out.classification,'RESCUE')
})
test('retire requires a mature post plus measured weak retention and engagement',()=>{
  const out=classifyGrowthPost('tiktok',metrics({
    ageHours:72,views:80,likes:2,comments:0,shares:0,
    durationSeconds:60,averageWatchSeconds:5,
  }),{...tiktok,watchToDurationPercent:30})
  assert.equal(out.classification,'RETIRE')
})
test('no premature retirement when retention data is missing',()=>{
  const out=classifyGrowthPost('tiktok',metrics({
    ageHours:72,views:80,likes:2,comments:0,shares:0,averageWatchSeconds:null,
  }),{...tiktok,watchToDurationPercent:30})
  assert.equal(out.classification,'MEASURE')
})
test('a post with null views never becomes a zero-view failure',()=>{
  const out=classifyGrowthPost('youtube',{
    publishedDate:'2026-09-09',postId:'no-views',views:null,
  },{viewsPerUpload:250})
  assert.equal(out.classification,'AWAIT_DATA')
  assert.equal(out.signals.views,null)
})
