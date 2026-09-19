import test from 'node:test'
import assert from 'node:assert/strict'
import { planRetentionExperiments } from './v60-retention-experiments.mjs'

const now=new Date('2026-09-19T12:00:00.000Z')
const tt=(extra={})=>({
  source:'CONNECTED_METRICOOL',capturedAt:'2026-09-19T11:30:00.000Z',
  freshness:{status:'FRESH'},records:[],...extra,
})
const row=(postId,publishedDate,durationSeconds,averageWatchSeconds,views=150)=>({
  postId,publishedDate,durationSeconds,averageWatchSeconds,views,topic:'Original biblical theme '+postId,
})
test('plans at most three original one-variable experiments across length bands',()=>{
  const evidence=tt({records:[
    row('a','2026-09-10',20,6),
    row('b','2026-09-10',35,7),
    row('c','2026-09-10',60,6),
    row('d','2026-09-10',58,10),
  ]})
  const plan=planRetentionExperiments({platform:'tiktok',evidence,now})
  assert.equal(plan.status,'PROPOSED')
  assert.equal(plan.experiments.length,3)
  assert.deepEqual(new Set(plan.experiments.map(x=>x.durationBand)),new Set(['SHORT','MEDIUM','LONG']))
  assert.equal(plan.experiments.find(x=>x.durationBand==='LONG').singleVariable,'RUNTIME_TRIM')
  for(const e of plan.experiments){
    assert.equal(e.mustNotAutomaticallyPost,true)
    assert.equal(e.newMasterRequiresFullApproval,true)
    assert.equal(e.decision,'AWAIT_TEMPLATE_REVIEW')
    assert.ok(e.holdConstant.length>=4)
  }
})
test('experiment ids are stable across identical evidence',()=>{
  const evidence=tt({records:[row('a','2026-09-10',20,6),row('b','2026-09-10',60,12)]})
  const a=planRetentionExperiments({platform:'tiktok',evidence,now})
  const b=planRetentionExperiments({platform:'tiktok',evidence,now})
  assert.deepEqual(a.experiments.map(x=>x.id),b.experiments.map(x=>x.id))
})
test('YouTube without watch-time evidence remains blocked',()=>{
  const evidence=tt({records:[
    row('abc','2026-09-10',35,null),
    row('def','2026-09-10',50,null),
  ]})
  const plan=planRetentionExperiments({platform:'youtube',evidence,now})
  assert.equal(plan.status,'BLOCKED_INSUFFICIENT_COMPARABLE_POSTS')
  assert.deepEqual(plan.experiments,[])
})
test('stale post-level analytics never result in a new experiment',()=>{
  const evidence=tt({freshness:{status:'STALE'},records:[
    row('a','2026-09-10',20,6),row('b','2026-09-10',60,12),
  ]})
  const plan=planRetentionExperiments({platform:'tiktok',evidence,now})
  assert.equal(plan.status,'BLOCKED_STALE_OR_MISSING_MEASUREMENTS')
  assert.deepEqual(plan.experiments,[])
})
test('one recent post alone cannot create an ungrounded experiment',()=>{
  const evidence=tt({records:[
    row('a','2026-09-19T10:00:00Z',20,6),
    row('b','2026-09-10',60,12),
  ]})
  const plan=planRetentionExperiments({platform:'tiktok',evidence,now})
  assert.equal(plan.eligiblePosts,1)
  assert.equal(plan.experiments.length,0)
})
test('zero or missing views and watch time are not interpreted as poor retention',()=>{
  const evidence=tt({records:[
    row('a','2026-09-10',20,0,0),
    row('b','2026-09-10',60,null,150),
    row('c','2026-09-10',30,7,160),
  ]})
  const plan=planRetentionExperiments({platform:'tiktok',evidence,now})
  assert.equal(plan.eligiblePosts,1)
  assert.equal(plan.experiments.length,0)
})
