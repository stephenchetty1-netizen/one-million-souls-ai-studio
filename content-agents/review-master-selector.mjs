// Pure, zero-credit exact-master selection for independent review packets.
// A rendered master is reviewable, never automatically approved for posting.
const REJECTED_BE_STILL_SHAS=new Set([
  '1051326a9a05f2912096b5c2e18bf59595b01b0bbca289b7833c12192c68767e',
  'a7896243ecab6a778ac39ca61147c26dd575fe9612d5f7e3fc2f9db76812e6ea'
])
const validHash=value=>/^[a-f0-9]{64}$/i.test(String(value||''))
export function creativelyRejected(entry){
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
