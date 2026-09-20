import { christianVisualSourceReviewed } from './christian-visual-editorial-gate.mjs'

// Unreviewed previews are private, but must not keep resurfacing footage that
// has since been rejected or replaced by a different exact MP4.
export function inspectCurrentPrivatePreview(preview,manifest){
 const blockers=[]
 if(!preview||preview.unreviewedSourcePreview!==true||preview.sourceReviewRequired!==true||
    !HASH.test(String(preview.masterHash||''))||
    manifest?.collection!=='BE_STILL_PEXELS_V1'||manifest?.formatId!=='SHORT_59')
   blockers.push('PRIVATE_PREVIEW_OR_SOURCE_BANK_INVALID')
 const all=Array.isArray(manifest?.assets)?manifest.assets:[]
 const scenes=Array.isArray(preview?.sourceScenes)?preview.sourceScenes:[]
 if(scenes.length!==9)blockers.push('PRIVATE_PREVIEW_REQUIRES_NINE_SOURCE_SCENES')
 const seen=new Set()
 for(let i=0;i<scenes.length;i++){
  const scene=scenes[i]
  const id=String(scene?.id||'')
  const identity=id+':'+String(scene?.sourceVideoHash||'').toLowerCase()
  if(seen.has(identity))blockers.push('PRIVATE_PREVIEW_DUPLICATE_SOURCE_'+i)
  seen.add(identity)
  const source=all.find(x=>String(x?.id)===id)
  if(!source||!HASH.test(String(scene?.sourceVideoHash||''))||
     String(source.videoSha256||'').toLowerCase()!==String(scene?.sourceVideoHash||'').toLowerCase()||
     source.reviewStatus==='REJECTED_CHRISTIAN_STORY_FIT'||
     source.visualChristianEditorialStatus==='REJECTED_CHRISTIAN_STORY_FIT')
   blockers.push('PRIVATE_PREVIEW_REJECTED_OR_REPLACED_SOURCE_'+i)
 }
 return {ready:blockers.length===0,blockers,publishingAllowed:false,certified:false}
}

// Never expose an older approved-source draft as the current reviewed edit
// after any source is rejected, replaced, reordered or rehashed.
// This is a review gate only; it neither certifies nor authorizes publication.
const HASH=/^[a-f0-9]{64}$/i
export function inspectCurrentReviewedShortDraft(draft,manifest){
 const blockers=[]
 if(!draft||draft.unreviewedSourcePreview===true||draft.sourceReviewRequired===true||
    draft.publishingAllowed===true||draft.masterReady===true||
    !HASH.test(String(draft.masterHash||''))||
    draft.measured?.fullDecodePassed!==true||
    draft.voiceover!==true||draft.captionsPresent!==true)
   blockers.push('EXACT_REVIEWED_DRAFT_INVALID')
 const all=Array.isArray(manifest?.assets)?manifest.assets:[]
 if(manifest?.collection!=='BE_STILL_PEXELS_V1'||manifest?.formatId!=='SHORT_59'||
    manifest?.sourceBankReady!==true||manifest?.christianVisualEditorialReady!==true)
   blockers.push('CURRENT_SOURCE_BANK_NOT_APPROVED')
 const selected=all.filter(christianVisualSourceReviewed).slice(0,9)
 const scenes=Array.isArray(draft?.sourceScenes)?draft.sourceScenes:[]
 if(selected.length!==9||scenes.length!==9)
   blockers.push('NINE_EXACT_REVIEWED_SOURCES_REQUIRED')
 const seen=new Set()
 for(let i=0;i<scenes.length;i++){
  const scene=scenes[i],source=selected[i]
  const identity=String(scene?.id||'')+':'+String(scene?.sourceVideoHash||'').toLowerCase()
  if(seen.has(identity))blockers.push('DUPLICATE_DRAFT_SOURCE_'+i)
  seen.add(identity)
  if(!source||String(scene?.id)!==String(source.id)||
     String(scene?.sourceVideoHash||'').toLowerCase()!==String(source.videoSha256||'').toLowerCase()||
     !HASH.test(String(scene?.sourceVideoHash||'')))
    blockers.push('REVIEWED_SOURCE_REVOKED_OR_CHANGED_'+i)
 }
 return {ready:blockers.length===0,blockers,sourceCount:selected.length,
  publishingAllowed:false,certified:false}
}

export function inspectCurrentReviewedLongDraft(draft,manifest){
 const blockers=[]
 const required=24
 if(!draft||draft.profileId!=='YOUTUBE_LONG'||draft.publishingAllowed===true||
    draft.masterReady===true||!HASH.test(String(draft.masterHash||''))||
    draft.measured?.fullDecodePassed!==true||
    Number(draft.measured?.durationSeconds)<239||
    draft.voiceover!==true||draft.onScreenWords!==true||
    Number(draft.voiceSeconds)<=0)
   blockers.push('LONG_DRAFT_AUDIOVISUAL_MASTER_INVALID')
 const all=Array.isArray(manifest?.assets)?manifest.assets:[]
 if(manifest?.collection!=='YOUTUBE_WORSHIP_LANDSCAPE_V1'||
    manifest?.formatId!=='YOUTUBE_LONG'||
    manifest?.sourceBankReady!==true||
    manifest?.christianVisualEditorialReady!==true)
   blockers.push('LONG_SOURCE_BANK_NOT_APPROVED')
 const selected=all.filter(christianVisualSourceReviewed).slice(0,required)
 const scenes=Array.isArray(draft?.sourceScenes)?draft.sourceScenes:[]
 if(selected.length!==required||scenes.length!==required)
   blockers.push('TWENTY_FOUR_EXACT_REVIEWED_SOURCES_REQUIRED')
 const seen=new Set()
 for(let i=0;i<scenes.length;i++){
  const scene=scenes[i],source=selected[i]
  const id='pexels-'+String(source?.id??'')
  const identity=String(scene?.stockId||'')+':'+String(scene?.sourceVideoHash||'').toLowerCase()
  if(seen.has(identity))blockers.push('DUPLICATE_LONG_SOURCE_'+i)
  seen.add(identity)
  if(!source||scene?.stockId!==id||
     String(scene?.sourceVideoHash||'').toLowerCase()!==String(source.videoSha256||'').toLowerCase()||
     !HASH.test(String(scene?.sourceVideoHash||'')))
    blockers.push('LONG_SOURCE_REVOKED_OR_CHANGED_'+i)
 }
 return {ready:blockers.length===0,blockers,sourceCount:selected.length,
    publishingAllowed:false,certified:false}
}
