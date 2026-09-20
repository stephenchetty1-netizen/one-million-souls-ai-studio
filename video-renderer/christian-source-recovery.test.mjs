import test from 'node:test'
import assert from 'node:assert/strict'
import {planRejectedSourceRecovery,SOURCE_REPLACEMENT_MAX_ATTEMPTS} from './christian-source-recovery.mjs'
test('review-only Shorts replacement regenerates fresh preview for nine technical clips',()=>{
 const result=planRejectedSourceRecovery('SHORT_59',{format:'SHORT_59',
   sourceClips:9,technicalSourceReady:true},{privatePreviewEnabled:true})
 assert.equal(result.regeneratePrivatePreview,true)
 assert.equal(result.retry,false)
 assert.equal(result.publishingAllowed,false)
 assert.equal(result.certified,false)
})
test('incomplete or mismatched footage gets retry rather than invented certification',()=>{
 const partial=planRejectedSourceRecovery('SHORT_59',{format:'SHORT_59',
   sourceClips:8,technicalSourceReady:false},{privatePreviewEnabled:true})
 assert.equal(partial.retry,true)
 assert.equal(partial.regeneratePrivatePreview,false)
 assert.equal(planRejectedSourceRecovery('SHORT_59',{format:'YOUTUBE_LONG',
   sourceClips:24,technicalSourceReady:true},{privatePreviewEnabled:true}).retry,true)
})
test('long-form recovery never triggers Shorts preview or social publishing',()=>{
 const result=planRejectedSourceRecovery('YOUTUBE_LONG',{format:'YOUTUBE_LONG',
   sourceClips:24,technicalSourceReady:true},{privatePreviewEnabled:true})
 assert.equal(result.retry,false)
 assert.equal(result.regeneratePrivatePreview,false)
 assert.equal(result.publishingAllowed,false)
 assert.equal(SOURCE_REPLACEMENT_MAX_ATTEMPTS,4)
})
test('private preview remains disabled without explicit flag',()=>{
 const result=planRejectedSourceRecovery('SHORT_59',{format:'SHORT_59',
   sourceClips:9,technicalSourceReady:true})
 assert.equal(result.regeneratePrivatePreview,false)
 assert.throws(()=>planRejectedSourceRecovery('UNKNOWN',{}),/UNSUPPORTED/)
})
