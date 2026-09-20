// Editorial revocations from the user's direct review of the Amazing Grace
// worship drafts. Neither stock search keywords nor technical metadata prove
// that a scene depicts Christian prayer or a Christian Bible.
// Do NOT infer an individual's religion from clothing or appearance.
export const REVOKED_WORSHIP_MASTERS=Object.freeze([
 '9ce6a7c24f91f24c11d0e4ce20210712ec5a82b050a9b4960607d1e7ecd064e0',
 '7c83f42184d5df46cdb9f86ba066e84c7354b02114c9e60fa9a434b6d3d4105b',
 '26e66db356fd15971b59d2084bd6d9fc14854a8da6490c2b56076951937ba2d3',
 // The earlier 19.73s BE STILL draft reused the same rejected prayer / book clips.
 'b2e593bbea508c0941aa38dad56454832f06ab8c711ef88c45b67da35f769157',
])
const REVOCATIONS=new Set(REVOKED_WORSHIP_MASTERS)
export const REVOKED_WORSHIP_MEDIA_KEYS=Object.freeze([
 'music-video-review-v1/SHORT_59/17cc4ceb-0a61-46d2-a350-859c034c6b18.mp4',
 'music-video-review-v1/SHORT_59/17cc4ceb-0a61-46d2-a350-859c034c6b18-contact.jpg',
 'music-video-review-v1/YOUTUBE_LONG/96ddf4dd-5df8-47bd-81ca-1da16705b919.mp4',
 'music-video-review-v1/YOUTUBE_LONG/96ddf4dd-5df8-47bd-81ca-1da16705b919-contact.jpg',
 'music-video-review-v1/7e6e1cb6-095c-4a22-98d5-b0bdce63113d.mp4',
 'music-video-review-v1/7e6e1cb6-095c-4a22-98d5-b0bdce63113d-contact.jpg',
 'renders-v2/2026-09-19/b8fda554-9723-4a73-81af-e5b72cfeef36.mp4',
 'review-v2/2026-09-19/b8fda554-9723-4a73-81af-e5b72cfeef36-contact.jpg',
 'review-v2/2026-09-19/b8fda554-9723-4a73-81af-e5b72cfeef36-first.jpg',
 'review-v2/2026-09-19/b8fda554-9723-4a73-81af-e5b72cfeef36-last.jpg',
 'review-v2/2026-09-19/b8fda554-9723-4a73-81af-e5b72cfeef36-thumbnail.jpg',
])
const REVOKED_KEYS=new Set(REVOKED_WORSHIP_MEDIA_KEYS)
export function worshipMasterRevoked(hash){return REVOCATIONS.has(String(hash||'').toLowerCase())}
export function worshipMediaRevoked(key){return REVOKED_KEYS.has(String(key||''))}
export function christianVisualSourceReviewed(source){
 // A downloaded file is only cleared when a human confirms the visual content
 // against the exact MP4 SHA, not by text search, contributor, costume, or scene labels.
 return Boolean(
  source?.visualChristianEditorialStatus==='APPROVED_CHRISTIAN_STORY_FIT'&&
  source?.visualReviewBasis==='HUMAN_FULL_SOURCE_WATCH'&&
  /^[a-f0-9]{64}$/i.test(String(source?.videoSha256||''))&&
  String(source?.visualReviewedVideoSha256||'').toLowerCase()===
    String(source?.videoSha256||'').toLowerCase()&&
  source?.christianScriptureOrPrayerVisualVerified===true&&
  (source?.bookInScene!==true||source?.bookIsBibleVerified===true)&&
  source?.hasConflictingReligiousTextOrRitual!==true
 )
}
export function christianVisualReviewReadiness(sources){
 const clips=Array.isArray(sources)?sources:[]
 const reviewed=clips.filter(christianVisualSourceReviewed)
 return {reviewedClips:reviewed.length,totalClips:clips.length,
  pending:clips.filter(x=>!christianVisualSourceReviewed(x)).map(x=>({
    id:x?.id||null,sourceVideoHash:x?.videoSha256||null,
    reason:'HUMAN_CHRISTIAN_VISUAL_REVIEW_REQUIRED'
  })),publishingAllowed:false}
}
