'use strict';
const $=id=>document.getElementById(id);
let selected=null,sourceList=[],playedToEnd=false;
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
async function loadReviewedDraft(){
 const status=$('reviewed-draft-status');
 status.textContent='Checking for the new reviewed-source draft…';
 try{
  const isLong=format()==='YOUTUBE_LONG';
  const url=isLong?'/christian-reviewed-long-draft-latest':'/christian-reviewed-draft-latest';
  const data=await request(url);
  $('reviewed-draft').src=data.mediaUrl;
  $('reviewed-draft').load();
  status.textContent='REVIEWED SOURCE VIDEO — '+data.sourceClips+
   ' individually approved source clips, voice-over and on-screen words. Exact MP4 SHA-256: '+
   data.masterHash+'. NOT CERTIFIED. Do not post until final audiovisual and rights review passes.';
 }catch(e){
  $('reviewed-draft').removeAttribute('src');$('reviewed-draft').load();
  status.textContent='Not ready: '+e.message+
   '. Complete all '+(format()==='YOUTUBE_LONG'?24:9)+' source approvals; the renderer then creates the next draft.';
 }
}
$('load-reviewed-draft').onclick=()=>loadReviewedDraft();
$('load-full-preview').onclick=()=>loadFullPreview();
$('sign-in').onclick=async()=>{
 try{
  const secret=$('secret').value;
  await request('/christian-review-login',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({secret})});
  $('secret').value='';$('login').hidden=true;$('review').hidden=false;await load();await loadFullPreview();await loadReviewedDraft();
 }catch(e){message(e.message)}
};
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
  const result=await request('/christian-review-decision',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify(body)});
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
request('/christian-review-queue?format=SHORT_59').then(async()=>{
 $('login').hidden=true;$('review').hidden=false;await load();await loadFullPreview();return loadReviewedDraft();
}).catch(()=>{});
