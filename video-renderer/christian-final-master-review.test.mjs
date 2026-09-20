import test from 'node:test'
import assert from 'node:assert/strict'
import {validateChristianFinalReview,MASTER_REVIEW_ATTESTATION,MASTER_REVIEW_GATES}
 from './christian-final-master-review.mjs'
const hash='a'.repeat(64)
const draft={id:'abc',masterHash:hash}
function review(extra={}){
 return {id:'abc',format:'SHORT_59',masterHash:hash,decision:'APPROVE',
  reviewer:'Independent reviewer',notes:'Watched complete final narrated video and listened to the entire mix.',
  attestation:MASTER_REVIEW_ATTESTATION,
  ...Object.fromEntries(MASTER_REVIEW_GATES.map(k=>[k,true])),...extra}
}
test('exact watched and evaluated master records editorial approval but NOT release certification',()=>{
 const out=validateChristianFinalReview(draft,review())
 assert.equal(out.decision,'APPROVE')
 assert.equal(out.masterHash,hash)
 assert.equal(out.certification,'NOT_CERTIFIED')
 assert.equal(out.publishingAllowed,false)
 assert.equal(out.publishingLocked,true)
 assert.equal(out.fullWatch,true)
})
test('no stale MP4, wrong id, or missing continuous watch can pass approval',()=>{
 for(const changed of [{masterHash:'b'.repeat(64)},{id:'other'},{attestation:'I_SKIPPED_TO_END'}])
  assert.throws(()=>validateChristianFinalReview(draft,review(changed)))
})
test('no unlistened mix, unverified imagery, caption failure or unchecked rights pass',()=>{
 for(const gate of MASTER_REVIEW_GATES)
  assert.throws(()=>validateChristianFinalReview(draft,review({[gate]:false})),/GATES_NOT_CONFIRMED/)
})
test('specific rejection can record partial watch without claiming full audio assessment',()=>{
 const out=validateChristianFinalReview(draft,review({
  decision:'REJECT',attestation:'',naturalVoiceVerified:false,
  notes:'Scene 3 displays a book that cannot be verified as a Bible.'
 }))
 assert.equal(out.fullWatch,false)
 assert.equal(out.checks.naturalVoiceVerified,false)
 assert.equal(out.certification,'NOT_CERTIFIED')
})
test('reject blank notes or unsupported format',()=>{
 assert.throws(()=>validateChristianFinalReview(draft,review({notes:'generic'})))
 assert.throws(()=>validateChristianFinalReview(draft,review({format:'FAKE'})))
})
