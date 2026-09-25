import test from "node:test";
import assert from "node:assert/strict";
import {LANES,makePlan,createTask,setStatus,validateImport,summarize,createCreativeBrief} from "../engine.mjs";
test("two separate 8-step workflows",()=>{
 const a=makePlan("oms","Psalm 91"),b=makePlan("onehub","Content Pack");
 assert.equal(a.length,8);assert.equal(b.length,8);
 assert.ok(a.every(t=>t.lane==="oms"));assert.ok(b.every(t=>t.lane==="onehub"));
 assert.equal(summarize([...a,...b],"oms").total,8);
});
test("Christian media approval fails closed",()=>{
 const t=createTask("oms",LANES.oms.stages[5],"Master");
 assert.throws(()=>setStatus(t,"approved"),/checks/);
 t.checks=[...LANES.oms.checks];assert.throws(()=>setStatus(t,"approved"),/evidence/);
 t.evidence="Final file reviewed";assert.throws(()=>setStatus(t,"approved"),/SHA-256/);
 t.masterHash="a".repeat(64);assert.equal(setStatus(t,"approved").status,"approved");
});
test("business evidence required and publishing not supported",()=>{
 const t=createTask("onehub",LANES.onehub.stages[4],"Offer");
 t.checks=[...LANES.onehub.checks];t.evidence="Checked offer";
 assert.equal(setStatus(t,"approved").status,"approved");
 assert.throws(()=>setStatus(t,"published"),/Invalid status/);
});
test("forged backup approval reset",()=>{
 const t=createTask("oms",LANES.oms.stages[5],"Review");t.status="approved";
 const a=validateImport({schema:1,tasks:[t]});assert.equal(a[0].status,"needs_review");
});
test("even fully checked imported master must be re-reviewed",()=>{
 const t=createTask("oms",LANES.oms.stages[5],"Master");
 t.checks=[...LANES.oms.checks];t.evidence="Claimed review";t.masterHash="b".repeat(64);t.status="approved";
 assert.equal(validateImport({schema:1,tasks:[t]})[0].status,"needs_review");
});
test("review stages cannot be completed before approval",()=>{
 for(const lane of ["oms","onehub"]){
  const t=createTask(lane,lane==="oms"?"Final master review":"Human approval","Review");
  assert.throws(()=>setStatus(t,"done"),/Human approval/);
 }
});
test("extra fields cannot replace missing approval evidence",()=>{
 const t=createTask("oms","Final master review","Review");
 assert.throws(()=>setStatus(t,"approved",{checks:[],evidence:"",masterHash:"a".repeat(64)}));
});

test("brief generator returns actionable drafts without pretending to publish",()=>{
 const video=createCreativeBrief("oms","Psalm 91:1");
 assert.match(video,/50–59/);assert.match(video,/SHA-256/);assert.match(video,/Publishing remains OFF/);
 const business=createCreativeBrief("onehub","Content Pack");
 assert.match(business,/Five post concepts/);assert.match(business,/verified PayPal/);
 assert.throws(()=>createCreativeBrief("unknown","topic"));
 assert.throws(()=>createCreativeBrief("oms","  "));
});

test("review completion requires real prior approval and evidence",()=>{
 for(const [lane,stage] of [["oms","Final master review"],["onehub","Human approval"]]){
  const t=createTask(lane,stage,"Review");
  assert.throws(()=>setStatus(t,"done"),/Human approval/);
  t.checks=[...LANES[lane].checks];t.evidence="Observed final deliverable";
  if(lane==="oms")t.masterHash="a".repeat(64);
  assert.throws(()=>setStatus(t,"done"),/Human approval/);
  const approved=setStatus(t,"approved");
  assert.equal(setStatus(approved,"done").status,"done");
 }
});
test("no local sales or distribution completion and no forged backup completions",()=>{
 const cases=[["oms","Distribution handoff"],["onehub","Organic distribution handoff"],["onehub","Verified sales measurement"]];
 const tasks=cases.map(([lane,stage])=>createTask(lane,stage,"Unverified action"));
 for(const t of tasks)assert.throws(()=>setStatus(t,"done"),/cannot|PayPal/);
 const claimed=tasks.map(t=>({...t,status:"done"}));
 const imported=validateImport({schema:1,tasks:claimed});
 assert.ok(imported.every(t=>t.status==="needs_review"));
});
