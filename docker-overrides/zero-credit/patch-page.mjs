import fs from 'node:fs'
const file='app/page.tsx'
let source=fs.readFileSync(file,'utf8')
const replacements=[
  ['OpenAI Responses API','Zero-credit Scripture drafts'],
  ['Browser → Next.js server → OpenAI. API key stays server-side.','Browser → Next.js server → curated local Scripture templates. No paid AI calls.'],
  ['Research Scripture, build a devotional, run biblical and platform quality gates, then prepare the post for the One Million Souls autopilot.','Prepare a curated, Scripture-referenced devotional draft with zero AI credits. Review Scripture, rights, and quality before any publication.'],
  ['Create TikTok devotional','Create zero-credit draft'],
  ['Generate three 9:16 visual directions. You approve everything before publishing.','Three suggested 9:16 visual prompts; no images are generated or billed. You approve everything before publishing.'],
  ['<button className="secondary" onClick={makeImages} disabled={imageLoading}>{imageLoading?<><span className="spinner dark"/>Generating…</>:<>Generate images →</>}</button>','<p className="note">Zero-credit mode: use original or properly licensed visuals. Paid image generation is disabled.</p>'],
  ['🟢 AUTOPILOT + LEARNING','📝 DRAFT ONLY — HUMAN REVIEW REQUIRED'],
  ['After biblical, safety and platform checks pass, the campaign can enter the publishing queue. Performance data feeds the Growth Manager and experimentation engine.','This template draft is not certified, queued, rendered or published. Verify passages and source rights before any release.'],
  ['Needs revision','Review required']
]
for (const [from,to] of replacements){
  if (!source.includes(from)) throw new Error('V59_UI_PATCH_SOURCE_CHANGED: '+from.slice(0,70))
  source=source.replace(from,to)
}
fs.writeFileSync(file,source)
console.log('ZERO_CREDIT_UI_PATCH_APPLIED',JSON.stringify({replacements:replacements.length,paidImageButtonRemoved:!source.includes('>Generate images →')}))
