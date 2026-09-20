'use strict';
const $=id=>document.getElementById(id);
let selected=null,sourceList=[],playedToEnd=false;
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
 $('approve').disabled=true;$('reject').disabled=true;
}
function valid(){
 const watched=playedToEnd&&$('watched').checked&&selected;
 const named=$('reviewer').value.trim().length>=2;
 const notes=$('notes').value.trim().length>=12;
 const book=document.querySelector('input[name=book]:checked');
 $('reject').disabled=!(watched&&named&&notes&&book);
 $('approve').disabled=!(watched&&named&&notes&&book&&$('christian').checked&&
  !$('conflict').checked&&(book.value==='no'||$('bible').checked));
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
 message('Review source '+selected.id+' in full before recording a decision.');
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
$('sign-in').onclick=async()=>{
 try{
  const secret=$('secret').value;
  await request('/christian-review-login',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({secret})});
  $('secret').value='';$('login').hidden=true;$('review').hidden=false;await load();
 }catch(e){message(e.message)}
};
$('format').onchange=()=>load().catch(e=>message(e.message));
$('clip').addEventListener('ended',()=>{playedToEnd=true;message('Playback ended. Confirm full watch and complete the content checklist.',true);valid()});
for(const id of ['watched','reviewer','notes','christian','conflict','bible'])
 $(id).addEventListener('input',valid);
document.querySelectorAll('input[name=book]').forEach(x=>x.addEventListener('change',valid));
async function decide(decision){
 if(!selected||!playedToEnd||!$('watched').checked)return message('Watch the complete exact source video first.');
 const book=document.querySelector('input[name=book]:checked');
 if(!book)return message('Select whether a book appears.');
 const body={format:format(),id:selected.id,sourceVideoHash:selected.sourceVideoHash,
  reviewer:$('reviewer').value,notes:$('notes').value,decision,
  attestation:'I_WATCHED_ENTIRE_EXACT_SOURCE_VIDEO',
  bookInScene:book.value==='yes',bookIsBibleVerified:$('bible').checked,
  christianScriptureOrPrayerVisualVerified:$('christian').checked,
  hasConflictingReligiousTextOrRitual:$('conflict').checked};
 try{
  $('approve').disabled=true;$('reject').disabled=true;
  const result=await request('/christian-review-decision',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  await load();message('Recorded '+decision+' for exact source '+result.id+
   '. '+result.reviewed+'/'+result.required+' clips approved. Publishing remains locked.',true);
 }catch(e){message(e.message);valid()}
}
$('approve').onclick=()=>decide('APPROVE');
$('reject').onclick=()=>decide('REJECT');
request('/christian-review-queue?format=SHORT_59').then(()=>{
 $('login').hidden=true;$('review').hidden=false;return load();
}).catch(()=>{});
