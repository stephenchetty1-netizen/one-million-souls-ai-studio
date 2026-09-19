#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "content-agents");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "tiktok-search-intelligence.json"), "utf8"));

const evidenceFile = process.env.TIKTOK_SEARCH_EVIDENCE || path.join(ROOT, "tiktok-search-evidence.json");
const outFile = process.env.TIKTOK_SEARCH_QUEUE || path.join(ROOT, "tiktok-search-candidate-queue.json");

const normalize = (s="") => s.toLowerCase().replace(/[^a-z0-9' ]/g," ").replace(/\s+/g," ").trim();
const now = new Date().toISOString();

let evidence = { creator_search_insights: [], creator_insights: [], web_intel: [] };
if (fs.existsSync(evidenceFile)) {
  try { evidence = { ...evidence, ...JSON.parse(fs.readFileSync(evidenceFile,"utf8")) }; }
  catch (err) { console.error("Invalid TikTok evidence JSON:", err.message); process.exit(2); }
}

const seeds = Object.entries(CONFIG.seed_clusters).flatMap(([cluster, qs]) => qs.map(query => ({query, cluster, source:"seed"})));
const discovered = [
  ...(evidence.web_intel || []).map(x => ({...x, source:"web"})),
  ...(evidence.creator_search_insights || []).map(x => ({...x, source:"creator_search_insights"}))
];

const byQuery = new Map();
for (const item of [...seeds, ...discovered]) {
  const query = String(item.query || item.term || "").trim();
  if (!query) continue;
  const key = normalize(query);
  const prev = byQuery.get(key) || { query, cluster:item.cluster || "discovered", evidence:[] };
  prev.evidence.push(item);
  byQuery.set(key, prev);
}

const creatorPatterns = evidence.creator_insights || [];
const candidates = [...byQuery.values()].map(c => {
  const csi = c.evidence.find(e => e.source === "creator_search_insights");
  const web = c.evidence.some(e => e.source === "web");
  const verifiedGap = Boolean(csi?.content_gap === true && (csi?.evidence_url || csi?.evidence_id || csi?.captured_at));
  const popularity = Number(csi?.popularity || csi?.search_interest || 0);
  const creatorMatch = creatorPatterns.some(p => normalize(JSON.stringify(p)).includes(normalize(c.query).split(" ")[0]));

  let score = 0;
  score += Math.min(25, popularity > 0 ? 15 + Math.min(10, popularity) : 10);
  if (verifiedGap) score += 30;
  score += 20;
  if (creatorMatch) score += 10;
  if (web) score += 5;
  if (c.query.split(/\s+/).length >= 3) score += 5;

  return {
    ...c,
    score: Math.min(100, score),
    verified_content_gap: verifiedGap,
    content_gap_status: verifiedGap ? "VERIFIED" : "UNVERIFIED",
    production_eligible: verifiedGap || c.evidence.length >= 2,
    target_format: "one-search-question-per-video",
    generated_at: now
  };
}).sort((a,b) => b.score-a.score || a.query.localeCompare(b.query));

const output = {
  version: CONFIG.version,
  generated_at: now,
  safeguards: {
    content_gap_claim_requires_tiktok_evidence: true,
    creator_copying: false,
    scripture_accuracy_required: true,
    master_ready_required: true,
    publishing_gate_unchanged: true
  },
  stats: {
    candidates: candidates.length,
    verified_content_gaps: candidates.filter(x=>x.verified_content_gap).length,
    production_eligible: candidates.filter(x=>x.production_eligible).length
  },
  candidates
};

fs.writeFileSync(outFile, JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify(output.stats));
