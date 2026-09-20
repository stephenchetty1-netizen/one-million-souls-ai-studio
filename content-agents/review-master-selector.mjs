// Pure, zero-credit exact-master selection for independent review packets.
// A rendered master is reviewable, never automatically approved for posting.
const REJECTED_BE_STILL_SHAS=new Set([
  '1051326a9a05f2912096b5c2e18bf59595b01b0bbca289b7833c12192c68767e',
  'a7896243ecab6a778ac39ca61147c26dd575fe9612d5f7e3fc2f9db76812e6ea',
  // Rejected Amazing Grace Pexels visuals: 59s portrait, 4m landscape, and 18s proof of concept.
  '9ce6a7c24f91f24c11d0e4ce20210712ec5a82b050a9b4960607d1e7ecd064e0',
  '7c83f42184d5df46cdb9f86ba066e84c7354b02114c9e60fa9a434b6d3d4105b',
  '26e66db356fd15971b59d2084bd6d9fc14854a8da6490c2b56076951937ba2d3',
  // Reused same three editorially rejected clips in the 19.73s BE STILL render.
  'b2e593bbea508c0941aa38dad56454832f06ab8c711ef88c45b67da35f769157'
])
const validHash=value=>/^[a-f0-9]{64}$/i.test(String(value||''))
function short59Valid(entry){
  const seconds=Number(entry?.durationSeconds||0)
  const width=Number(entry?.width||entry?.masterInspection?.width||0)
  const height=Number(entry?.height||entry?.masterInspection?.height||0)
  const fps=Number(entry?.fps||entry?.masterInspection?.fps||0)
  return seconds>=58.7&&seconds<=59.3&&width>=1080&&height>=1920&&height>width&&fps>=29.9
}
export function creativelyRejected(entry){
  if(entry?.mediaUrl&&!short59Valid(entry))return true
  if(REJECTED_BE_STILL_SHAS.has(String(entry?.masterHash||'').toLowerCase()))return true
  if(Array.isArray(entry?.sceneSources)&&entry.sceneSources.length>0&&
    entry.sceneSources.every(source=>source==='rights-cleared-stock-video'))return true
  if(String(entry?.title||'').trim().toUpperCase()!=='BE STILL')return false
  return (entry?.rightsClearedStockScenes||[]).some(x=>x?.stockId==='sunrise-storm-portrait')||
    (entry?.visualStoryboardInspection?.beats||[]).some(x=>x?.stockId==='sunrise-storm-portrait')
}
export function reviewableExactMaster(entry){
  return Boolean(entry&&!creativelyRejected(entry)&&
    validHash(entry.contentHash)&&validHash(entry.masterHash)&&
    String(entry.releasePayload?.masterHash||'').toLowerCase()===String(entry.masterHash).toLowerCase()&&
    entry.renderQualityGate==='PASS'&&entry.professionalMasterCandidate===true&&
    entry.releaseStatus==='AWAITING_MASTER_CERTIFICATION'&&
    entry.fullDecodeInspection?.passed===true&&entry.mediaUrl&&
    entry.reviewAssets?.audioReviewUrl&&validHash(entry.reviewAssets?.audioReviewHash))
}
export function selectExactMasterForReview({publicEntry=null,buildingEntry=null}={}){
  // A validated newer partial production takes precedence over an older
  // public review archive, even if the whole day is not yet completed.
  if(reviewableExactMaster(buildingEntry))
    return {entry:buildingEntry,source:'building',reason:null}
  if(reviewableExactMaster(publicEntry))
    return {entry:publicEntry,source:'public',reason:null}
  const rejected=creativelyRejected(publicEntry)||creativelyRejected(buildingEntry)
  return {entry:null,source:null,reason:rejected
    ?'CREATIVE_REJECTION_NEW_MASTER_REQUIRED':'EXACT_MASTER_PENDING'}
}
