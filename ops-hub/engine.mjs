/** Deterministic, dependency-free two-workspace planning engine; no publisher or paid API. */
export const LANES=Object.freeze({
oms:{name:"One Million Souls",stages:["Research","Script & storyboard","Asset sourcing","Production","Creative & technical QA","Final master review","Distribution handoff","Measurement"],checks:["Christian context reviewed","Footage and music rights verified","Technical and creative QA passed","Exact final master hash recorded","Human approval of exact master"]},
onehub:{name:"OneHub AI Business",stages:["Offer research","Content strategy","Creative production","Offer & rights QA","Human approval","Organic distribution handoff","Lead / referral review","Verified sales measurement"],checks:["Offer and price verified","Deliverables confirmed","Rights and factual claims checked","No invented reviews or revenue","Human approval of final creative"]}
});
export const STATUSES=["planned","in_progress","needs_review","approved","done","blocked"];
export const SAFE_SCHEMA=1;
export const now=()=>new Date().toISOString();
export function safeText(v,n=1000){return String(v??"").trim().slice(0,n)}
export function makeId(){return globalThis.crypto?.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2)}
export function createTask(lane,stage,title,notes=""){
 if(!LANES[lane]||!LANES[lane].stages.includes(stage))throw Error("Invalid workspace or stage");
 const t=safeText(title,120);if(!t)throw Error("Task title required");
 return {id:makeId(),lane,stage,title:t,notes:safeText(notes,2000),status:"planned",checks:[],evidence:"",masterHash:"",createdAt:now(),updatedAt:now(),approvedAt:null};
}
export function makePlan(lane,topic){
 if(!LANES[lane])throw Error("Unknown workspace");
 const t=safeText(topic,120);if(!t)throw Error("Enter a topic or campaign");
 return LANES[lane].stages.map((s,i)=>createTask(lane,s,s+" — "+t,i?"Depends on "+LANES[lane].stages[i-1]+". Not completed AI work.":"Research brief: "+t));
}
function isReviewStage(task){
 return (task.lane==="oms"&&task.stage==="Final master review")||(task.lane==="onehub"&&task.stage==="Human approval");
}
function verifyReviewEvidence(task){
 const checks=LANES[task.lane]?.checks||[];
 if(!checks.every(x=>Array.isArray(task.checks)&&task.checks.includes(x)))throw Error("Complete all review checks first");
 if(!safeText(task.evidence,500))throw Error("Add review evidence before approval");
 if(task.lane==="oms"&&!/^[a-f\d]{64}$/i.test(task.masterHash))throw Error("Record exact final master SHA-256");
}
export function setStatus(task,status,extras={}){
 if(!LANES[task.lane]||!LANES[task.lane].stages.includes(task.stage))throw Error("Invalid workspace or stage");
 if(!STATUSES.includes(status))throw Error("Invalid status");
 if(status==="approved")verifyReviewEvidence(task);
 if(status==="done"){
  if(["Distribution handoff","Organic distribution handoff"].includes(task.stage))throw Error("This local workbench cannot confirm external distribution");
  if(task.lane==="onehub"&&task.stage==="Verified sales measurement")throw Error("Independent PayPal evidence required; local task cannot verify sales");
  if(isReviewStage(task)){
   if(task.status!=="approved"||!task.approvedAt)throw Error("Human approval required before completing this review stage");
   verifyReviewEvidence(task);
  }
 }
 return {...task,...extras,status,updatedAt:now(),approvedAt:status==="approved"?now():status==="planned"?null:task.approvedAt};
}
export function validateImport(value){
 if(!value||value.schema!==SAFE_SCHEMA||!Array.isArray(value.tasks)||value.tasks.length>1000)throw Error("Invalid backup");
 return value.tasks.map(t=>{
  if(!t||!LANES[t.lane]||!LANES[t.lane].stages.includes(t.stage)||!STATUSES.includes(t.status))throw Error("Invalid task");
  const v={...createTask(t.lane,t.stage,safeText(t.title,120),safeText(t.notes,2000)),id:safeText(t.id,120)||makeId(),status:t.status,checks:Array.isArray(t.checks)?t.checks.filter(x=>LANES[t.lane].checks.includes(x)):[],evidence:safeText(t.evidence,2000),masterHash:safeText(t.masterHash,64),createdAt:safeText(t.createdAt,40)||now(),updatedAt:safeText(t.updatedAt,40)||now(),approvedAt:t.approvedAt?safeText(t.approvedAt,40):null};
  const review=(v.lane==="oms"&&v.stage==="Final master review")||(v.lane==="onehub"&&v.stage==="Human approval");
  if(v.status==="approved"||(review&&v.status==="done")||(v.status==="done"&&(["Distribution handoff","Organic distribution handoff"].includes(v.stage)||(v.lane==="onehub"&&v.stage==="Verified sales measurement")))){v.status="needs_review";v.approvedAt=null}
  return v;
 });
}
export function summarize(tasks,lane){const t=tasks.filter(x=>x.lane===lane);return {total:t.length,active:t.filter(x=>x.status==="in_progress").length,review:t.filter(x=>x.status==="needs_review").length,blocked:t.filter(x=>x.status==="blocked").length,approved:t.filter(x=>x.status==="approved").length}}


/** Produce a draft for human editors; no renderer, publisher, payments or remote tools. */
export function createCreativeBrief(lane,subject){
 if(!LANES[lane])throw Error("Unknown workspace");
 const topic=safeText(subject,120).replace(/[\r\n]+/g," ");
 if(!topic)throw Error("Enter a topic or campaign");
 const date=now().slice(0,10);
 if(lane==="oms")return `# ONE MILLION SOULS — CINEMATIC CONTENT HANDOFF
Date: ${date}
Topic: ${topic}
Status: DRAFT. No video generated, footage licensed or social post published.

## Technical
59-second vertical 9:16 video; target 1080×1920, 30fps. No voiceover; use music only after rights verification. Blue/white/black/silver/gold; kinetic 3D typography and cinematic pacing.

## Edit timeline
| Seconds | Visual | On-screen direction |
|---|---|---|
| 00–04 | Dark-to-light 3D reveal | ${topic} |
| 04–12 | Slow cinematic scene | WHEN LIFE FEELS UNCERTAIN |
| 12–24 | Christian-context cross / open Bible | GOD'S WORD IS AN ANCHOR |
| 24–37 | Golden light with restrained particles | PAUSE. RETURN TO HIS PROMISES. |
| 37–50 | Strongest approved imagery | [INSERT CHECKED SCRIPTURE OR THEME LINE] |
| 50–59 | Minimal brand end card | ONE MISSION · ONE MILLION SOULS |

Caption draft: ${topic} — turn to Scripture and bring your worries to God in prayer. #OneMillionSouls #Faith #Bible

## Non-negotiable QA
- [ ] Verify actual Bible wording and translation; no invented Scripture quotes.
- [ ] Individually verify video, image and music licenses.
- [ ] Check content suitability, subtitle legibility, audio, pacing, 9:16 output and exact duration.
- [ ] Record exact final MP4 SHA-256 and obtain separate human approval.
- [ ] Publishing remains OFF. Approval in this workbench does not certify a V59 master.
`;
 return `# ONEHUB AI BUSINESS — FIVE-POST DRAFT HANDOFF
Date: ${date}
Campaign: ${topic}
Status: DRAFT. No final graphics, customers contacted or payments verified.

Product page: https://onehub-ai-business.floot.app/social-media-content
Existing offer to recheck before use: one-time US$30.54, five original post designs, five matching captions, one consolidated revision round. Delivery after verified payment and completed brief; no guaranteed marketing outcomes or delivery date.

## Five post concepts
1. Five floating post frames — YOUR BUSINESS, FIVE FRESH POSTS. Caption: Five original designs and five captions tailored to your brief.
2. Recognisable colour system — LOOK CONSISTENT, NOT GENERIC. Caption: Give your next five posts a connected visual direction.
3. 5 + 5 + 1 editorial checklist — WHAT'S INCLUDED. Caption: Five custom graphics, five captions and a revision round, one-time US$30.54.
4. Brief → payment verification → design → delivery — HOW IT WORKS. Caption: Tell us about your business and share your brand details after checkout.
5. Minimal CTA — READY FOR YOUR NEXT FIVE POSTS? Caption: Explore the full pack details at the official product page.

## Non-negotiable QA
- [ ] Reverify current price, offer and destination link before use.
- [ ] Produce five actual original graphics; do not pass concepts off as finished.
- [ ] Check licensing and legibility on Android.
- [ ] Obtain human approval before external distribution.
- [ ] Record PAID only from independently verified PayPal transactions; CRM leads are not revenue.
- [ ] No posting, messaging, spending or third-party signups through this workbench.
`;
}
