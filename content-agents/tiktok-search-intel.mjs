#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const ROOT=path.resolve(process.cwd(),"content-agents");
const cfg=JSON.parse(fs.readFileSync(path.join(ROOT,"tiktok-search-intelligence.json"),"utf8"));
const evPath=process.env.TIKTOK_SEARCH_EVIDENCE||path.join(ROOT,"tiktok-search-evidence.json");
const out=process.env.TIKTOK_SEARCH_QUEUE||path.join(ROOT,"tiktok-search-candidate-queue.json");
let ev={creator_search_insights:[],creator_insights:[],web_intel:[]}; if(fs.existsSync(evPath)) ev={...ev,...JSON.parse(fs.readFileSync(evPath,"utf8"))};
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9' ]/g," ").replace(/\s+/g," ").trim();
const map=new Map(); const seeds=Object.entries(cfg.seed_clusters).flatMap(([cluster,qs])=>qs.map(query=>({query,cluster,source:"seed"})));
for(const x of [...seeds,...ev.web_intel.map(x=>({...x,source:"web"})),...ev.creator_search_insights.map(x=>({...x,source:"creator_search_insights"}))]){if(!x.query)continue;const k=norm(x.query),p=map.get(k)||{query:x.query,cluster:x.cluster||"discovered",evidence:[]};p.evidence.push(x);map.set(k,p);}
const candidates=[...map.values()].map(c=>{
  const csi=c.evidence.find(e=>e.source==="creator_search_insights");
  const referenced=Boolean(csi?.content_gap===true&&(csi?.evidence_url||csi?.evidence_id));
  const ownerScreenshot=referenced&&csi?.source_type==="OWNER_SCREENSHOT";
  // A creator-owned screenshot is evidence of what their UI displayed, not independent API verification.
  const independentlyVerified=referenced&&csi?.source_type==="TIKTOK_API";
  const score=30+(referenced?30:0)+(c.evidence.some(e=>e.source==="web")?5:0)+(c.query.split(/\s+/).length>=3?5:0);
  return {...c,score,reported_content_gap:referenced,verified_content_gap:independentlyVerified,
    content_gap_status:independentlyVerified?"API_VERIFIED":ownerScreenshot?"OWNER_SCREENSHOT_REPORTED":referenced?"REFERENCED_UNVERIFIED":"UNVERIFIED",
    production_eligible:referenced||c.evidence.length>=2};
}).sort((a,b)=>b.score-a.score);
const result={version:cfg.version,generated_at:new Date().toISOString(),safeguards:{content_gap_claim_requires_tiktok_evidence:true,scripture_accuracy_required:true,master_ready_required:true,publishing_gate_unchanged:true},stats:{candidates:candidates.length,verified_content_gaps:candidates.filter(x=>x.verified_content_gap).length,owner_screenshot_reported_content_gaps:candidates.filter(x=>x.content_gap_status==="OWNER_SCREENSHOT_REPORTED").length,production_eligible:candidates.filter(x=>x.production_eligible).length},candidates};
fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n"); console.log(JSON.stringify(result.stats));
