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
async function load(){
 const data=await request('/christian-review-queue?format='+encodeURIComponent(format()));
 sourceList=data.assets;selected=null;$('clip').removeAttribute('src');$('clip').load();clearReview();
 $('summary').textContent=data.reviewed+'/'+data.required+' Christian source videos approved; '+data.total+' staged.';
 const sources=$('sources');sources.replaceChildren();
 for(const source of sourceList){
  const b=document.createElement('button');b.type='button';b.className='source';b.dataset.id=String(source.id);
  b.textContent=source.id+' — '+(source.sourceSlot||source.intent||'Shot')+
   ' — '+source.reviewStatus.replaceAll('_',' ');
  b.addEventListener('click',()=>selectSource(source.id));sources.append(b);
 }
 message('Video source review queue loaded.',true);
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
$('load-full-preview').onclick=()=>loadFullPreview();
$('sign-in').onclick=async()=>{
 try{
  const secret=$('secret').value;
  await request('/christian-review-login',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({secret})});
  $('secret').value='';$('login').hidden=true;$('review').hidden=false;await load();await loadFullPreview();
 }catch(e){message(e.message)}
};
$('format').onchange=()=>load().catch(e=>message(e.message));
$('clip').addEventListener('ended',()=>{playedToEnd=true;message('Playback ended. Confirm full watch and complete the content checklist.',true);valid()});
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
  await load();message('Recorded '+decision+' for exact source '+result.id+
   '. '+result.reviewed+'/'+result.required+' clips approved. Publishing remains locked.',true);
  reviewStatus('Decision recorded successfully. Select the next clip.',true);
 }catch(e){message(e.message);reviewStatus('Decision not saved: '+e.message);$('approve').disabled=false;$('reject').disabled=false;valid()}
}
$('approve').onclick=()=>decide('APPROVE');
$('reject').onclick=()=>decide('REJECT');
request('/christian-review-queue?format=SHORT_59').then(()=>{
 $('login').hidden=true;$('review').hidden=false;await load();return loadFullPreview();
}).catch(()=>{});
