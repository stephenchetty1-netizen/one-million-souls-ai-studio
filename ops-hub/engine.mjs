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
export function setStatus(task,status,extras={}){
 if(!STATUSES.includes(status))throw Error("Invalid status");
 if(status==="approved"){
 const checks=LANES[task.lane]?.checks||[];
 if(!checks.every(x=>task.checks.includes(x)))throw Error("Complete all review checks first");
 if(!safeText(task.evidence,500))throw Error("Add review evidence before approval");
 if(task.lane==="oms"&&!/^[a-f\d]{64}$/i.test(task.masterHash))throw Error("Record exact final master SHA-256");
 }
 return {...task,...extras,status,updatedAt:now(),approvedAt:status==="approved"?now():status==="planned"?null:task.approvedAt};
}
export function validateImport(value){
 if(!value||value.schema!==SAFE_SCHEMA||!Array.isArray(value.tasks)||value.tasks.length>1000)throw Error("Invalid backup");
 return value.tasks.map(t=>{
 if(!t||!LANES[t.lane]||!LANES[t.lane].stages.includes(t.stage)||!STATUSES.includes(t.status))throw Error("Invalid task");
 const v={...createTask(t.lane,t.stage,safeText(t.title,120),safeText(t.notes,2000)),id:safeText(t.id,120)||makeId(),status:t.status,checks:Array.isArray(t.checks)?t.checks.filter(x=>LANES[t.lane].checks.includes(x)):[],evidence:safeText(t.evidence,2000),masterHash:safeText(t.masterHash,64),createdAt:safeText(t.createdAt,40)||now(),updatedAt:safeText(t.updatedAt,40)||now(),approvedAt:t.approvedAt?safeText(t.approvedAt,40):null};
 if(v.status==="approved"){try{setStatus(v,"approved")}catch{v.status="needs_review";v.approvedAt=null}}
 return v;
 });
}
export function summarize(tasks,lane){const t=tasks.filter(x=>x.lane===lane);return {total:t.length,active:t.filter(x=>x.status==="in_progress").length,review:t.filter(x=>x.status==="needs_review").length,blocked:t.filter(x=>x.status==="blocked").length,approved:t.filter(x=>x.status==="approved").length}}
