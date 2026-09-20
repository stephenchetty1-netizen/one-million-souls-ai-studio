import test from 'node:test'
import assert from 'node:assert/strict'
import { computeReviewWindow } from './review-window.mjs'

test('rolls Johannesburg midnight into the next 14-day production review',()=>{
 const x=computeReviewWindow({now:new Date('2026-09-20T22:45:00Z')})
 assert.deepEqual(x,{startDate:'2026-09-22',days:14,rolling:true,timezone:'Africa/Johannesburg'})
})
test('legacy REVIEW_START_DATE cannot pin a rolling release audit',()=>{
 const x=computeReviewWindow({now:new Date('2026-09-20T21:45:00Z'),fixedStartDate:'2026-01-01'})
 assert.equal(x.startDate,'2026-09-22')
 assert.equal(x.rolling,true)
})
test('explicit fixed test window is possible but visible and opt-in',()=>{
 const x=computeReviewWindow({now:new Date('2026-09-20T21:45:00Z'),fixedEnabled:true,
  fixedStartDate:'2026-09-30',days:3})
 assert.equal(x.startDate,'2026-09-30')
 assert.equal(x.rolling,false)
})
test('refuses invalid dates and buffer lengths',()=>{
 assert.throws(()=>computeReviewWindow({days:42}),/REVIEW_DAYS/)
 assert.throws(()=>computeReviewWindow({fixedEnabled:true,fixedStartDate:'2026-02-30'}),/REVIEW_START_DATE/)
})
