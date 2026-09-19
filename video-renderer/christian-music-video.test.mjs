import test from 'node:test'
import assert from 'node:assert/strict'
import {musicVideoContract} from './christian-music-video.mjs'

test('Christian music video uses documented Amazing Grace hymn recording, not Pexels silent clip audio',()=>{
 assert.equal(musicVideoContract.title,'AMAZING GRACE')
 assert.match(musicVideoContract.musicSourcePage,/commons\.wikimedia\.org\/wiki\/File:Amazing_Grace_2011/)
 assert.equal(musicVideoContract.musicLicense,'CC BY 3.0')
})
test('three Pexels prayer-to-Scripture music beats last a coherent short reel',()=>{
 assert.equal(musicVideoContract.collection,'BE_STILL_PEXELS_V1')
 assert.equal(musicVideoContract.bpmReference,79)
 assert.ok(musicVideoContract.secondsPerShot>6&&musicVideoContract.secondsPerShot<6.2)
 assert.ok(musicVideoContract.durationSeconds>18&&musicVideoContract.durationSeconds<18.5)
})
test('music-led draft cannot become an autonomous publishing approval',()=>{
 assert.equal(musicVideoContract.publishingAllowed,false)
 assert.equal(musicVideoContract.independentEditorialReviewRequired,true)
})
