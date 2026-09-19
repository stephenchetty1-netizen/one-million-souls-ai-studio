import test from 'node:test'
import assert from 'node:assert/strict'
import {creativelyRejected,reviewableExactMaster,selectExactMasterForReview} from './review-master-selector.mjs'
const OLD='1051326a9a05f2912096b5c2e18bf59595b01b0bbca289b7833c12192c68767e'
const A='a'.repeat(64),B='b'.repeat(64)
function master(hash=A,title='BE STILL',extra={}){
  return {title,masterHash:hash,contentHash:A,
    releasePayload:{masterHash:hash},mediaUrl:'https://renderer.example/media/test.mp4',
    renderQualityGate:'PASS',professionalMasterCandidate:true,
    releaseStatus:'AWAITING_MASTER_CERTIFICATION',fullDecodeInspection:{passed:true},
    reviewAssets:{audioReviewUrl:'https://renderer.example/media/audio.wav',audioReviewHash:B},...extra}
}
test('new building BE STILL replaces rejected public master',()=>{
  const selected=selectExactMasterForReview({publicEntry:master(OLD),buildingEntry:master(B)})
  assert.equal(selected.source,'building')
  assert.equal(selected.entry.masterHash,B)
  assert.equal(creativelyRejected(master(OLD)),true)
})
test('weather-map BE STILL rejected even with a different SHA',()=>{
  const branded=master(A,'BE STILL',{rightsClearedStockScenes:[{stockId:'sunrise-storm-portrait'}]})
  assert.equal(reviewableExactMaster(branded),false)
  assert.equal(selectExactMasterForReview({publicEntry:branded}).reason,'CREATIVE_REJECTION_NEW_MASTER_REQUIRED')
})
test('safe public master survives building retry placeholder',()=>{
  const retry={title:'BE STILL',releaseStatus:'PRODUCTION_RETRY'}
  const selected=selectExactMasterForReview({publicEntry:master(A),buildingEntry:retry})
  assert.equal(selected.source,'public')
})
test('technical pass never equals independent approval',()=>{
  const selected=selectExactMasterForReview({buildingEntry:master(B)})
  assert.equal(selected.source,'building')
  assert.equal(selected.entry.releaseStatus,'AWAITING_MASTER_CERTIFICATION')
  assert.equal(selected.entry.masterReady,undefined)
})
test('no rejected master falls through as an asset',()=>{
  const selected=selectExactMasterForReview({publicEntry:master(OLD),buildingEntry:{title:'BE STILL',releaseStatus:'PRODUCTION_RETRY'}})
  assert.equal(selected.entry,null)
  assert.equal(selected.reason,'CREATIVE_REJECTION_NEW_MASTER_REQUIRED')
})
test('other titles do not gain random stock publishing authority',()=>{
  const selected=selectExactMasterForReview({publicEntry:master(A,'GOD IS NEAR',{renderQualityGate:'BLOCK'})})
  assert.equal(selected.entry,null)
  assert.equal(selected.reason,'EXACT_MASTER_PENDING')
})
