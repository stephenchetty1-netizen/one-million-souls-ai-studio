import test from 'node:test'
import assert from 'node:assert/strict'
import {NARRATED_SHORT,reviewNarratedShortScript,captionAss} from './christian-narrated-short.mjs'
test('59-second devotional has a spoken original Christian hook, Scripture and next action',()=>{
 const inspection=reviewNarratedShortScript()
 assert.ok(inspection.wordCount>=90&&inspection.wordCount<=145)
 assert.equal(NARRATED_SHORT.targetSeconds,59)
 assert.equal(NARRATED_SHORT.needsVoiceover,true)
 assert.equal(NARRATED_SHORT.needsCaptions,true)
 assert.equal(NARRATED_SHORT.publishingAllowed,false)
 assert.match(NARRATED_SHORT.script,/Jesus/)
 assert.match(NARRATED_SHORT.script,/Bible/)
 assert.equal(NARRATED_SHORT.reference,'Philippians 1:6')
})
test('word-level caption groups have legible 1080x1920 safe margins',()=>{
 const captions=captionAss()
 assert.match(captions,/PlayResX: 1080/)
 assert.match(captions,/PlayResY: 1920/)
 assert.match(captions,/,125,125,490,1/)
 const events=captions.split('\n').filter(x=>x.startsWith('Dialogue:'))
 assert.ok(events.length>=20)
 assert.ok(events.some(e=>e.includes('God')))
})
test('reject hollow, off-theme or excessive narration',()=>{
 assert.throws(()=>reviewNarratedShortScript('Jesus loves you.'),/WORD_COUNT/)
 assert.throws(()=>reviewNarratedShortScript('random '.repeat(146)),/WORD_COUNT/)
 assert.throws(()=>reviewNarratedShortScript('generic inspirational words '.repeat(45)),/CHRISTIAN_SCRIPT/)
})
