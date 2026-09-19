import test from 'node:test'
import assert from 'node:assert/strict'
import {musicVideoContract} from './christian-music-video.mjs'

test('Christian music video uses documented Amazing Grace hymn recording, not Pexels silent clip audio',()=>{
 assert.equal(musicVideoContract.title,'AMAZING GRACE')
 assert.match(musicVideoContract.musicSourcePage,/commons\.wikimedia\.org\/wiki\/File:Amazing_Grace_2011/)
 assert.equal(musicVideoContract.musicLicense,'CC BY 3.0')
})
test('new shorts are 59 seconds, not the old 18-second proof-of-concept',()=>{
 assert.equal(musicVideoContract.collection,'BE_STILL_PEXELS_V1')
 assert.equal(musicVideoContract.shortDurationSeconds,59)
 assert.equal(musicVideoContract.formats.SHORT_59.durationSeconds,59)
 assert.equal(musicVideoContract.formats.SHORT_59.minimumDistinctClips,9)
 assert.equal(musicVideoContract.archivedPreviewDurationSeconds,18.228)
})
test('new long-form YouTube output uses four minutes of distinct landscape scenes',()=>{
 assert.equal(musicVideoContract.longFormDurationSeconds,240)
 assert.equal(musicVideoContract.formats.YOUTUBE_LONG.width,1920)
 assert.equal(musicVideoContract.formats.YOUTUBE_LONG.height,1080)
 assert.equal(musicVideoContract.formats.YOUTUBE_LONG.minimumDistinctClips,24)
})
test('music-led draft cannot become an autonomous publishing approval',()=>{
 assert.equal(musicVideoContract.publishingAllowed,false)
 assert.equal(musicVideoContract.independentEditorialReviewRequired,true)
})
