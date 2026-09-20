import test from 'node:test'
import assert from 'node:assert/strict'
import {credibleStoredCertificate} from './master-archive-search.mjs'
const gates=['rightsStatus','theologyStatus','factualStatus','mediaIntegrity','captionSync','audioMix',
 'visualQuality','thumbnailQuality','contentQuality','lyricSync','originality',
 'professionalExecution','technicalMaster','creativeMaster']
function certified(){return {
 certificateId:'test-only',reviewStandardVersion:'v59-independent-exact-master-v2',
 certification:'PROFESSIONAL_MASTER_CERTIFIED',masterReady:true,
 releaseStatus:'APPROVED_AWAITING_POST_TIME',requiredApprovals:50,
 masterHash:'f'.repeat(64),contentHash:'c'.repeat(64),
 qa:Object.fromEntries(gates.map(g=>[g,'PASS']))}}
test('candidate requires exact independent release record and all fourteen QA gates',()=>{
 assert.equal(credibleStoredCertificate(certified()),true)
 for(const change of [{masterReady:false},{requiredApprovals:49},{reviewStandardVersion:'legacy'},
 {certification:'UNREVIEWED'}])assert.equal(credibleStoredCertificate({...certified(),...change}),false)
})
test('revoked master cannot be returned as an archive candidate',()=>{
 assert.equal(credibleStoredCertificate({...certified(),
 masterHash:'9ce6a7c24f91f24c11d0e4ce20210712ec5a82b050a9b4960607d1e7ecd064e0'}),false)
})
test('no draft can become a certified master by having a mediaUrl only',()=>{
 assert.equal(credibleStoredCertificate({mediaUrl:'https://example.test/review.mp4',
 editorialStatus:'AWAITING_FULL_AUDIOVISUAL_AND_RIGHTS_REVIEW',
 publishingAllowed:false}),false)
})
test('exact nested certificate identity is mandatory',()=>{
 const c=certified()
 assert.equal(credibleStoredCertificate({certificate:c,masterHash:c.masterHash,contentHash:c.contentHash}),true)
 assert.equal(credibleStoredCertificate({certificate:c,masterHash:'a'.repeat(64)}),false)
 assert.equal(credibleStoredCertificate({certificate:{...c,qa:{...c.qa,creativeMaster:'BLOCK'}}}),false)
})
