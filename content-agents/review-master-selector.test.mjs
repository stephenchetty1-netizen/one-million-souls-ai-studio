import test from 'node:test'
import assert from 'node:assert/strict'
import {creativelyRejected,reviewableExactMaster,selectExactMasterForReview} from './review-master-selector.mjs'
const OLD='1051326a9a05f2912096b5c2e18bf59595b01b0bbca289b7833c12192c68767e'
const A='a'.repeat(64),B='b'.repeat(64)
function master(hash=A,title='BE STILL',extra={}){
  return {title,masterHash:hash,contentHash:A,
    releasePayload:{masterHash:hash},mediaUrl:'https://renderer.example/media/test.mp4',
    durationSeconds:59,width:1080,height:1920,fps:30,
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

test('independently rejected revised BE STILL cut cannot be reintroduced',()=>{
 const revised='a7896243ecab6a778ac39ca61147c26dd575fe9612d5f7e3fc2f9db76812e6ea'
 const result=selectExactMasterForReview({buildingEntry:master(revised)})
 assert.equal(result.entry,null)
 assert.equal(result.reason,'CREATIVE_REJECTION_NEW_MASTER_REQUIRED')
})
test('three licensed but unreviewed raw stock scenes are not professional review candidates',()=>{
 const stock=master(B,'DO NOT CARRY TOMORROW',{sceneSources:[
  'rights-cleared-stock-video','rights-cleared-stock-video','rights-cleared-stock-video'
 ]})
 assert.equal(reviewableExactMaster(stock),false)
 assert.equal(selectExactMasterForReview({buildingEntry:stock}).reason,'CREATIVE_REJECTION_NEW_MASTER_REQUIRED')
})
test('original visual motion survives the raw stock-only restriction, but remains pending review',()=>{
 const original=master(B,'BE STILL',{sceneSources:[
  'cloud-ai-video','cloud-ai-video','cloud-ai-video'
 ]})
 const result=selectExactMasterForReview({buildingEntry:original})
 assert.equal(result.entry.masterHash,B)
 assert.equal(result.entry.releaseStatus,'AWAITING_MASTER_CERTIFICATION')
})

test('a technically passing old twenty-second devotional cannot enter review',()=>{
  const old=master(A,'FAITH OVER FEAR',{durationSeconds:19.73})
  assert.equal(reviewableExactMaster(old),false)
  const result=selectExactMasterForReview({publicEntry:old})
  assert.equal(result.entry,null)
  assert.equal(result.reason,'CREATIVE_REJECTION_NEW_MASTER_REQUIRED')
})
test('portrait and frame-rate mismatch block an otherwise 59-second master',()=>{
  for(const change of [{width:1920,height:1080},{fps:24},{durationSeconds:60}]){
    assert.equal(reviewableExactMaster(master(A,'GOD IS NEAR',change)),false)
  }
})
