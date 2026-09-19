import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewDisposition } from './review-disposition.mjs'
test('missing visual and voice perceptual review holds exact master, no retry',()=>{
  const result=reviewDisposition({zeroCreditOnly:true,failed:[
    {gate:'fullWatch',status:'BLOCK'},
    {gate:'creativeMaster',status:'BLOCK'},
    {gate:'professionalExecutionInspection',status:'BLOCK'},
    {gate:'voicePerformanceInspection',status:'BLOCK'},
  ]})
  assert.equal(result.action,'HOLD_EXACT_MASTER_FOR_INDEPENDENT_REVIEW')
  assert.equal(result.requestProductionRetry,false)
  assert.equal(result.recordFinalQaBlock,false)
  assert.equal(result.publishingLocked,true)
})
test('independently measured technical failure still permits normal revision',()=>{
  const r=reviewDisposition({zeroCreditOnly:true,failed:[{gate:'exportInspection',status:'BLOCK'}]})
  assert.equal(r.action,'NORMAL_REVISION_PROCESS')
})
test('mixed review deficits and content failures do not masquerade as review-only',()=>{
  const r=reviewDisposition({zeroCreditOnly:true,failed:[
    {gate:'creativeMaster',status:'BLOCK'},{gate:'theologyInspection',status:'BLOCK'}]})
  assert.equal(r.action,'NORMAL_REVISION_PROCESS')
})
test('non-zero-credit evaluator failure is not silently treated as human waiting',()=>{
  const r=reviewDisposition({zeroCreditOnly:false,failed:[{gate:'voicePerformanceInspection'}]})
  assert.equal(r.action,'NORMAL_REVISION_PROCESS')
})
