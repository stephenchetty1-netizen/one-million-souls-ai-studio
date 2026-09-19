import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateReleaseReadiness } from './release-readiness.mjs'

const approved={
  allCertified:true,expected:21,certified:21,invalid:0,productionRetry:0,awaiting:0
}
const safeSystem={
  releaseReady:true,rendererVerified:true,exactMasterCertified:true,
  durableFiftyApprovalsVerified:true,publishingLocked:false,
}
const cert={readiness:approved}
function release(extra={}){
  return evaluateReleaseReadiness({
    system:safeSystem,certification:cert,publishEnabled:true,
    requiredApprovals:50,...extra,
  })
}
test('complete independently verified buffer and all gates can release',()=>{
  const r=release()
  assert.equal(r.releaseReady,true)
  assert.equal(r.publishingLocked,false)
})
test('certified legacy buffer cannot override unverified independent review',()=>{
  const r=release({system:{...safeSystem,releaseReady:false,rendererVerified:false}})
  assert.equal(r.publishingLocked,true)
  assert.ok(r.blockers.includes('INDEPENDENT_EXACT_MASTER_REVIEW_UNVERIFIED'))
})
test('publishing flag off always keeps gate locked',()=>{
  const r=release({publishEnabled:false})
  assert.equal(r.publishingLocked,true)
  assert.ok(r.blockers.includes('PUBLISH_FLAG_LOCKED'))
})
test('21 claimed certificates with one invalid stay locked',()=>{
  const r=release({certification:{readiness:{...approved,invalid:1}}})
  assert.equal(r.publishingLocked,true)
  assert.ok(r.blockers.includes('NO_INDEPENDENTLY_CERTIFIED_MASTER'))
})
test('50 approvals policy mismatch blocks release',()=>{
  const r=release({requiredApprovals:49})
  assert.equal(r.publishingLocked,true)
})
test('exact new certificate can release one master if system independently verified',()=>{
  const r=release({certification:{execution:{
    certification:'PROFESSIONAL_MASTER_CERTIFIED',
    releaseStatus:'APPROVED_AWAITING_POST_TIME',
    certificate:{reviewStandardVersion:'v59-independent-exact-master-v2'},
  }}})
  assert.equal(r.releaseReady,true)
})
test('legacy certificate cannot release one master',()=>{
  const r=release({certification:{execution:{
    certification:'PROFESSIONAL_MASTER_CERTIFIED',
    releaseStatus:'APPROVED_AWAITING_POST_TIME',
    certificate:{reviewStandardVersion:undefined},
  }}})
  assert.equal(r.releaseReady,false)
})
test('adapter availability is never proof of independent review',()=>{
  const r=release({system:{ready:true,connected:{research:true,production:true,approvals:true}}})
  assert.equal(r.publishingLocked,true)
})
