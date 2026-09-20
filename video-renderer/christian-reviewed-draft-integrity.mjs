import { christianVisualSourceReviewed } from './christian-visual-editorial-gate.mjs'

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
