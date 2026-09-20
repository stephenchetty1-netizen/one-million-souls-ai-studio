// A final-video editorial decision is hash-bound but IS NOT a professional
// master certificate, a source approval, or a publishing permission.
const HASH=/^[a-f0-9]{64}$/i
export const MASTER_REVIEW_ATTESTATION='I_WATCHED_ENTIRE_EXACT_FINAL_VIDEO_AND_LISTENED_TO_AUDIO'
export const MASTER_REVIEW_GATES=Object.freeze([
 'christianVisualContextVerified','scriptureContextVerified',
 'storyPacingVerified','naturalVoiceVerified','voiceMusicMixVerified',
 'captionReadabilityVerified','musicAndFootageRightsVerified',
])
export function validateChristianFinalReview(draft,body){
 const format=String(body?.format||'')
 const expected=String(draft?.masterHash||'').toLowerCase()
 if(!['SHORT_59','YOUTUBE_LONG'].includes(format)||
   !HASH.test(expected)||!HASH.test(String(body?.masterHash||''))||
   String(body.masterHash).toLowerCase()!==expected||
   String(body?.id||'')!==String(draft?.id||''))
  throw new Error('EXACT_CURRENT_FINAL_MASTER_SHA256_AND_ID_REQUIRED')
 const decision=String(body?.decision||'')
 if(!['APPROVE','REJECT'].includes(decision))
  throw new Error('EXPLICIT_FINAL_MASTER_DECISION_REQUIRED')
 const reviewer=String(body?.reviewer||'').trim().slice(0,100)
 const notes=String(body?.notes||'').trim().slice(0,1800)
 if(reviewer.length<2||notes.length<20)
  throw new Error('FINAL_REVIEWER_AND_SPECIFIC_NOTES_REQUIRED')
 const fullWatch=body?.attestation===MASTER_REVIEW_ATTESTATION
 if(decision==='APPROVE'&&!fullWatch)
  throw new Error('COMPLETE_EXACT_FINAL_VIDEO_AUDIO_WATCH_REQUIRED')
 const checks=Object.fromEntries(MASTER_REVIEW_GATES.map(k=>[k,body?.[k]===true]))
 const failed=MASTER_REVIEW_GATES.filter(k=>!checks[k])
 if(decision==='APPROVE'&&failed.length)
  throw new Error('FINAL_VIDEO_EDITORIAL_GATES_NOT_CONFIRMED: '+failed.join(','))
 return {format,id:String(draft.id),masterHash:expected,
  decision,reviewer,notes,checks,fullWatch,
  reviewStandard:'v59-exact-finished-video-human-editorial-v1',
  certification:'NOT_CERTIFIED',publishingAllowed:false,publishingLocked:true,
  independentFiftyAgentMasterCertification:'NOT_YET_VERIFIED'}
}
