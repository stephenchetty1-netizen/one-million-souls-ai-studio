import test from 'node:test'
import assert from 'node:assert/strict'
import {planVisualStory,stockSelectionForBeat,inspectVisualStoryboard,
        CAPTION_LAYOUT,STORYBOARD_VERSION} from './visual-storyboard.mjs'

const script='You were never asked to carry tomorrow before it arrives. In Matthew 6:34 Jesus teaches us not to be consumed by tomorrow worries. Give today your faithful attention. Pray about what you cannot control, do what is right in front of you, and trust God with what comes next.'
const make=()=>planVisualStory({title:'DO NOT CARRY TOMORROW',script,scriptureReference:'Matthew 6:34'})
const scenes=()=>make().beats.map((b,i)=>({
  local:'/tmp/scene-'+i+'.mp4',source:'rights-cleared-stock-video',
  stockId:b.stockId,sourcePage:'https://commons.wikimedia.org/wiki/File:Example',
  license:'CC0-1.0',rightsNote:'Checked source attribution',
  startSeconds:b.startSeconds||0,repriseOf:b.repriseOf??null,
}))
test('worry devotional no longer selects rejected weather-map or cave footage',()=>{
 const p=make()
 assert.equal(p.version,STORYBOARD_VERSION)
 assert.deepEqual(p.beats.map(b=>b.stage),['TENSION','SCRIPTURE','RESPONSE'])
 assert.deepEqual(p.beats.map(b=>b.stockId),[
  'shoreline-footprints-waves','pangong-lake-waves','golden-sunset-january'
 ])
 assert.equal(p.beats.some(beat=>['sunrise-storm-portrait','domica-cave'].includes(beat.stockId)),false)
 assert.equal(stockSelectionForBeat(p,2).repriseOf,null)
 assert.equal(p.publishingLocked,true)
})
test('revised coherent storyboard is only planning proof not perceptual approval',()=>{
 const r=inspectVisualStoryboard(make(),scenes())
 assert.equal(r.passed,true)
 assert.equal(r.humanPerceptualReviewRequired,true)
 assert.equal(r.publishingAuthority,false)
 assert.match(r.contractStatus,/REVIEW_PENDING/)
})
test('arbitrary stock selection fails closed for uncurated devotional',()=>{
 const p=planVisualStory({title:'UNMAPPED FUTURE DEVOTIONAL',script})
 assert.equal(p.stockStoryboardAvailable,false)
 assert.throws(()=>stockSelectionForBeat(p,0),/NO_SEMANTICALLY_CURATED_STOCK_SHOT/)
})
test('airplane footage in Scripture beat is rejected despite technical decode',()=>{
 const s=scenes();s[1].stockId='flight-over-clouds'
 assert.throws(()=>inspectVisualStoryboard(make(),s),/UNMATCHED_STOCK_SHOT/)
})
test('unplanned duplicate scene is rejected even if scene file differs',()=>{
 const s=scenes();s[2].stockId=s[0].stockId;s[2].repriseOf=null;s[2].startSeconds=s[0].startSeconds
 assert.throws(()=>inspectVisualStoryboard(make(),s),/UNPLANNED_DUPLICATE_STOCK/)
})
test('missing source rights fails storyboard gate',()=>{
 const s=scenes();s[1].license=''
 assert.throws(()=>inspectVisualStoryboard(make(),s),/STOCK_RIGHTS_MISSING/)
})
test('arbitrary number of manual prompts cannot sneak in extra scenes',()=>{
 assert.throws(()=>planVisualStory({title:'TEST',script,visualPrompts:['one','two','three','four']}),/EXACTLY_THREE/)
})
test('short or absent script fails before any stock downloads',()=>{
 assert.throws(()=>planVisualStory({title:'TEST',script:'Trust God'}),/SCRIPT_TOO_SHORT/)
})
test('platform UI clearance is larger than old 170px caption offset',()=>{
 assert.equal(CAPTION_LAYOUT.bottomMargin>=360,true)
 assert.equal(CAPTION_LAYOUT.leftMargin>=120,true)
 assert.equal(CAPTION_LAYOUT.rightMargin>=120,true)
 assert.equal(CAPTION_LAYOUT.maxWords<=4,true)
 assert.equal(CAPTION_LAYOUT.maxCharacters<=32,true)
})

test('BE STILL three-beat revision eliminates rejected branded weather-map source',()=>{
  const p=planVisualStory({title:'BE STILL',script,scriptureReference:'Psalm 46:10'})
  assert.deepEqual(p.beats.map(beat=>beat.stockId),[
    'shoreline-footprints-waves','pangong-lake-waves','golden-sunset-january'
  ])
  assert.equal(new Set(p.beats.map(beat=>beat.stockId)).size,3)
  assert.equal(p.beats.some(beat=>beat.stockId==='sunrise-storm-portrait'),false)
  assert.equal(p.stockStoryboardAvailable,true)
  const scenes=p.beats.map((beat,i)=>({
    local:'/tmp/still-'+i+'.mp4',source:'rights-cleared-stock-video',
    stockId:beat.stockId,sourcePage:'https://commons.wikimedia.org/wiki/File:Example',
    license:'CC0-1.0',rightsNote:'Verified individual CC0 source',
    startSeconds:beat.startSeconds||0,repriseOf:beat.repriseOf??null,
  }))
  assert.equal(inspectVisualStoryboard(p,scenes).passed,true)
  assert.equal(inspectVisualStoryboard(p,scenes).publishingAuthority,false)
})
