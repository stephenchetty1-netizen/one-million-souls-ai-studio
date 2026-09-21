'use strict';
const $=id=>document.getElementById(id);
let selected=null,sourceList=[],playedToEnd=false;
let finalDraft=null,finalPlaybackComplete=false;
const finalChecks=['christian','scripture','story','voice','mix','captions','rights'];
function finalEnabled(yes){$('final-approve').disabled=!yes;$('final-reject').disabled=!yes}
function clearFinalDraft(){
 finalDraft=null;finalPlaybackComplete=false;$('final-watched').checked=false;
 finalEnabled(false);$('final-review-status').textContent='Waiting for a current source-approved exact MP4.';
 $('final-decision-feedback').textContent='';
}

const reviewStatus=(s,ok=false)=>{const n=$('confirmation-status');if(n){n.textContent=s;n.className=ok?'ok':'warning'}};
const message=(s,ok=false)=>{const n=$('message');n.textContent=s;n.className=ok?'ok':'bad'};
async function request(path,opts={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts});
 const data=await response.json();if(!response.ok)throw Error(data?.error||'Request failed');
 return data;
}
function format(){return $('format').value}
function clearReview(){
 playedToEnd=false;$('watched').checked=false;$('notes').value='';$('christian').checked=false;
 $('conflict').checked=false;$('bible').checked=false;
 document.querySelectorAll('input[name=book]').forEach(x=>x.checked=false);
 $('approve').disabled=false;$('reject').disabled=false;
 reviewStatus('Watch the complete video; then tick the full-watch statement, enter your name and notes, and choose Approve or Reject.');
}
function missingFor(decision){
 const missing=[];
 if(!selected)missing.push('select one video');
 if(!playedToEnd)missing.push('play the selected exact source video through to its end');
 if(!$('watched').checked)missing.push('tick “I watched this exact video in full”');
 if($('reviewer').value.trim().length<2)missing.push('enter the reviewer name');
 if($('notes').value.trim().length<12)missing.push('enter at least 12 characters of specific visual notes');
 if(decision==='APPROVE'){
  const book=document.querySelector('input[name=book]:checked');
  if(!book)missing.push('answer whether a book appears');
  if(book?.value==='yes'&&!$('bible').checked)missing.push('verify that the visible book is a Bible');
  if(!$('christian').checked)missing.push('verify Christian prayer, Scripture or worship content');
  if($('conflict').checked)missing.push('reject footage with conflicting religious text or ritual');
 }
 return missing;
}
function valid(){
 if(!selected)return;
 const rejectMissing=missingFor('REJECT'),approveMissing=missingFor('APPROVE');
 reviewStatus(!rejectMissing.length&&!approveMissing.length
   ?'Ready: choose APPROVE or REJECT. Publishing remains locked.'
   :!rejectMissing.length
    ?'You can REJECT now. For approval also: '+approveMissing.join('; ')+'.'
    :'To record a review: '+rejectMissing.join('; ')+'.',
  !rejectMissing.length&&!approveMissing.length);
}
function selectSource(id){
 selected=sourceList.find(x=>String(x.id)===String(id));if(!selected)return;
 clearReview();
 $('clip-title').textContent='Video '+selected.id+' — '+(selected.sourceSlot||'Christian footage');
 $('purpose').textContent=selected.intent||'Review complete Christian visual context';
 $('source-info').textContent='Original SHA-256: '+selected.sourceVideoHash+
  ' | '+selected.width+'×'+selected.height+' | '+Number(selected.durationSeconds).toFixed(1)+' seconds'+
  ' | '+selected.reviewStatus;
 $('pexels-page').href=selected.pageUrl;
 $('clip').src='/christian-review-video?format='+encodeURIComponent(format())+'&id='+encodeURIComponent(selected.id);
 $('clip').load();
 document.querySelectorAll('button.source').forEach(b=>b.classList.toggle('active',b.dataset.id===String(id)));
 $('clip-title').scrollIntoView({behavior:'smooth',block:'start'});
 message('Review source '+selected.id+' in full before recording a decision.');
 valid();
}
function drawQueue(data){
 sourceList=data.assets;
 $('summary').textContent=data.reviewed+'/'+data.required+' Christian source videos approved; '+data.total+' staged.';
 const sources=$('sources');sources.replaceChildren();
 for(const source of sourceList){
  const b=document.createElement('button');b.type='button';b.className='source';b.dataset.id=String(source.id);
  b.textContent=source.id+' — '+(source.sourceSlot||source.intent||'Shot')+
   ' — '+source.reviewStatus.replaceAll('_',' ');
  b.addEventListener('click',()=>selectSource(source.id));sources.append(b);
 }
 if(selected)document.querySelectorAll('button.source').forEach(b=>
   b.classList.toggle('active',b.dataset.id===String(selected.id)));
}
async function load(){
 const data=await request('/christian-review-queue?format='+encodeURIComponent(format()));
 selected=null;$('clip').removeAttribute('src');$('clip').load();clearReview();
 drawQueue(data);
 message('Video source review queue loaded.',true);
}
let replacementMonitorToken=0;
function monitorReplacement(rejectedId,reviewFormat){
 const token=++replacementMonitorToken;
 const poll=async(attempt)=>{
  if(token!==replacementMonitorToken||format()!==reviewFormat)return;
  try{
   const data=await request('/christian-review-queue?format='+encodeURIComponent(reviewFormat));
   if(!data.assets.some(x=>String(x.id)===String(rejectedId))&&data.total>=data.required){
     // Update buttons without interrupting playback of another exact source.
     drawQueue(data);
     if(!selected){
       const next=sourceList.find(x=>x.reviewStatus!=='APPROVED_CHRISTIAN_STORY_FIT'&&
         x.reviewStatus!=='REJECTED_CHRISTIAN_STORY_FIT');
       if(next)selectSource(next.id);
     }
     if(reviewFormat==='SHORT_59')void loadFullPreview();
     message('Replacement footage is staged. Review its NEW exact video; no prior approval was reused.',true);
     return;
   }
  }catch(error){message('Replacement check: '+error.message)}
  if(attempt<24)setTimeout(()=>void poll(attempt+1),10000);
  else message('Replacement footage is not ready. No video will be published without review.');
 };
 setTimeout(()=>void poll(0),5000);
}
async function loadFullPreview(){
 const status=$('full-preview-status');
 status.textContent='Checking for an assembled full-length preview…';
 try{
  const data=await request('/christian-preview-latest');
  $('full-preview').src=data.mediaUrl;
  $('full-preview').load();
  status.textContent='PRIVATE UNREVIEWED DRAFT — 59 seconds. Exact MP4 SHA-256: '+
   data.masterHash+'. This is NOT a certified master or permission to post.';
 }catch(e){
  status.textContent='Full-length preview not available yet: '+e.message+
   '. The nine source videos can still be reviewed individually below.';
 }
}
async function loadFinalReviewStatus(){
 if(!finalDraft)return
 try{
  const d=await request('/christian-final-review-status?format='+encodeURIComponent(format()))
  if(d.masterHash!==finalDraft.masterHash||d.id!==finalDraft.id)
   throw Error('Finished video changed: reload exact MP4')
  $('final-review-status').textContent='Exact master SHA-256: '+d.masterHash+
   '. Final editorial decision: '+d.reviewStatus+'. Certificate: NOT CERTIFIED. Posting locked.'
 }catch(e){$('final-review-status').textContent='Final review status unavailable: '+e.message}
}
async function loadReviewedDraft(){
 const status=$('reviewed-draft-status');
 clearFinalDraft();
 status.textContent='Checking for the new reviewed-source draft…';
 try{
  const isLong=format()==='YOUTUBE_LONG';
  const url=isLong?'/christian-reviewed-long-draft-latest':'/christian-reviewed-draft-latest';
  const data=await request(url);
  finalDraft={id:data.id,masterHash:data.masterHash,format:format()};
  $('reviewed-draft').src=data.mediaUrl;
  $('reviewed-draft').load();
  finalEnabled(true);
  if(!$('final-reviewer').value.trim())$('final-reviewer').value=$('reviewer').value.trim();
  void loadFinalReviewStatus();
  status.textContent='REVIEWED SOURCE VIDEO — '+data.sourceClips+
   ' individually approved source clips, voice-over and on-screen words. Exact MP4 SHA-256: '+
   data.masterHash+'. NOT CERTIFIED. Do not post until final audiovisual and rights review passes.';
 }catch(e){
  $('reviewed-draft').removeAttribute('src');$('reviewed-draft').load();
  status.textContent='Not ready: '+e.message+
   '. Complete all '+(format()==='YOUTUBE_LONG'?24:9)+' source approvals; the renderer then creates the next draft.';
 }
}
function finalFullyWatched(){
 const v=$('reviewed-draft'),duration=Number(v.duration)
 if(!finalDraft||!Number.isFinite(duration)||duration<=0||
    !v.played||!v.played.length)return false
 let coverage=0,start=Infinity,end=0
 for(let i=0;i<v.played.length;i++){
  const a=v.played.start(i),b=v.played.end(i)
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)continue
  start=Math.min(start,a);end=Math.max(end,b);coverage+=b-a
 }
 return start<=Math.min(.5,duration*.05)&&
  end>=duration-Math.min(.5,duration*.05)&&
  coverage>=duration*.94&&
  Number(v.currentTime)>=duration-Math.min(.5,duration*.05)
}
function confirmFinalPlayback(){
 if(finalPlaybackComplete||!finalFullyWatched())return
 finalPlaybackComplete=true
 $('final-review-status').textContent='Complete exact finished-video playback verified. Review the full audio and picture, then record your decision.'
}
$('reviewed-draft').addEventListener('ended',confirmFinalPlayback)
$('reviewed-draft').addEventListener('timeupdate',confirmFinalPlayback)
async function recordFinalDecision(decision){
 const missing=[]
 if(!finalDraft||finalDraft.format!==format())missing.push('load the current reviewed-source draft')
 if($('final-reviewer').value.trim().length<2)missing.push('enter final reviewer name')
 if($('final-notes').value.trim().length<20)missing.push('add specific notes (20+ characters)')
 if(decision==='APPROVE'){
  if(!finalPlaybackComplete||!$('final-watched').checked)missing.push('watch the full exact MP4 with sound and check the full-watch declaration')
  for(const field of finalChecks)if(!$('final-'+field).checked)missing.push('verify '+field)
 }
 if(missing.length){
  $('final-decision-feedback').textContent='Cannot record final '+decision.toLowerCase()+': '+missing.join('; ')
  return
 }
 const checks={
  christianVisualContextVerified:$('final-christian').checked,
  scriptureContextVerified:$('final-scripture').checked,
  storyPacingVerified:$('final-story').checked,
  naturalVoiceVerified:$('final-voice').checked,
  voiceMusicMixVerified:$('final-mix').checked,
  captionReadabilityVerified:$('final-captions').checked,
  musicAndFootageRightsVerified:$('final-rights').checked
 }
 const body={...finalDraft,decision,reviewer:$('final-reviewer').value,
  notes:$('final-notes').value,
  attestation:finalPlaybackComplete&&$('final-watched').checked?
   'I_WATCHED_ENTIRE_EXACT_FINAL_VIDEO_AND_LISTENED_TO_AUDIO':'',...checks}
 try{
  finalEnabled(false)
  $('final-decision-feedback').textContent='Verifying exact MP4 SHA-256 and saving final editorial decision…'
  const result=await authorizedDecision('/christian-final-review-decision',body)
  $('final-decision-feedback').textContent='Saved '+result.decision+' for this exact finished MP4. '+result.finalEditorialStatus+
    '. Professional master certification and posting are still locked.'
  await loadFinalReviewStatus()
 }catch(e){$('final-decision-feedback').textContent='Final review not saved: '+e.message}
 finally{finalEnabled(Boolean(finalDraft))}
}
$('final-approve').onclick=()=>recordFinalDecision('APPROVE')
$('final-reject').onclick=()=>recordFinalDecision('REJECT')
clearFinalDraft()

$('load-reviewed-draft').onclick=()=>loadReviewedDraft();
$('load-full-preview').onclick=()=>loadFullPreview();
function requireDecisionCredential(detail){
 const field=$('secret');
 field.scrollIntoView({behavior:'smooth',block:'center'});
 field.focus({preventScroll:true});
 message(detail);
 throw Error(detail);
}
async function authorizedDecision(path,body){
 const credential=$('secret').value.trim();
 if(credential){
  try{
   await request('/christian-review-login',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({secret:credential})});
   $('secret').value='';
  }catch(error){
   if(error.message==='INVALID_REVIEWER_CREDENTIALS'||error.message==='REVIEW_LOGIN_UNAVAILABLE')
    requireDecisionCredential('Decision not saved: the renderer reviewer credential was rejected. Check VIDEO_RENDER_SECRET in Railway video-renderer Variables. Do not share it.');
   throw error;
  }
 }
 try{
  return await request(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 }catch(error){
  if(error.message==='REVIEWER_AUTH_REQUIRED')
   requireDecisionCredential('Decision not saved. Enter VIDEO_RENDER_SECRET in the decision authorization field above, then press the same Approve or Reject button again. Viewing clips does not require a credential.');
  throw error;
 }
}
$('format').onchange=()=>{replacementMonitorToken++;load().then(loadReviewedDraft).catch(e=>message(e.message))};
// Android video players sometimes omit 'ended'. Validate actual played ranges,
// not a seek-to-end or a checked declaration, and accept complete playback on
// either timeupdate or ended without reusing another source's history.
function sourceFullyWatched(){
 const v=$('clip'),duration=Number(v.duration)
 if(!Number.isFinite(duration)||duration<=0||!v.played||!v.played.length)return false
 let coverage=0,start=Infinity,end=0
 for(let i=0;i<v.played.length;i++){
  const a=v.played.start(i),b=v.played.end(i)
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)continue
  start=Math.min(start,a);end=Math.max(end,b);coverage+=b-a
 }
 return start<=Math.min(.5,duration*.05)&&
  end>=duration-Math.min(.5,duration*.05)&&
  coverage>=duration*.94&&
  Number(v.currentTime)>=duration-Math.min(.5,duration*.05)
}
function verifyCompletedPlayback(){
 if(playedToEnd||!sourceFullyWatched())return
 playedToEnd=true
 message('Complete playback verified. Confirm full watch and review this exact source.',true)
 valid()
}
$('clip').addEventListener('ended',verifyCompletedPlayback)
$('clip').addEventListener('timeupdate',verifyCompletedPlayback)
for(const id of ['watched','reviewer','notes','christian','conflict','bible'])
 $(id).addEventListener('input',valid);
document.querySelectorAll('input[name=book]').forEach(x=>x.addEventListener('change',valid));
async function decide(decision){
 const missing=missingFor(decision);
 if(missing.length){reviewStatus('Cannot '+decision.toLowerCase()+' yet: '+missing.join('; ')+'.');return}
 const book=document.querySelector('input[name=book]:checked');
 const body={format:format(),id:selected.id,sourceVideoHash:selected.sourceVideoHash,
  reviewer:$('reviewer').value,notes:$('notes').value,decision,
  attestation:'I_WATCHED_ENTIRE_EXACT_SOURCE_VIDEO',
  bookInScene:book?.value==='yes',bookIsBibleVerified:$('bible').checked,
  christianScriptureOrPrayerVisualVerified:$('christian').checked,
  hasConflictingReligiousTextOrRitual:$('conflict').checked};
 try{
  $('approve').disabled=true;$('reject').disabled=true;
  reviewStatus('Saving exact-source '+decision.toLowerCase()+' decision…',true);
  const result=await authorizedDecision('/christian-review-decision',body);
  await load();
  if(result.replacementQueued===true)monitorReplacement(result.id,result.format);
  if(result.sourceBankReady){
   // The exact-source review gate completed; the renderer is now building its
   // separate final draft. Do not treat this as a final master approval.
   $('reviewed-draft-status').textContent=
    'All '+result.required+' sources approved. Rendering the reviewed-source draft; check the new draft above.';
   void loadReviewedDraft();
  }else{
   // Mobile workflow: advance to the next unreviewed exact MP4, never approve
   // it by implication or reuse the previous full-watch attestation.
   const next=sourceList.find(x=>x.reviewStatus!=='APPROVED_CHRISTIAN_STORY_FIT'&&
    x.reviewStatus!=='REJECTED_CHRISTIAN_STORY_FIT');
   if(next)selectSource(next.id);
  }
  message('Saved '+decision+' on exact source '+result.id+
   '. '+result.reviewed+'/'+result.required+' approved. Publishing remains locked.',true);
  reviewStatus(result.sourceBankReady
   ?'All exact sources passed. The final narrated draft will appear above when rendered.'
   :'Saved. Watch the NEXT source from beginning before recording another decision.',true);
 }catch(e){message(e.message);reviewStatus('Decision not saved: '+e.message);$('approve').disabled=false;$('reject').disabled=false;valid()}
}
$('approve').onclick=()=>decide('APPROVE');
$('reject').onclick=()=>decide('REJECT');
load().then(async()=>{await loadFullPreview();return loadReviewedDraft()}).catch(e=>message('Review queue unavailable: '+e.message));
