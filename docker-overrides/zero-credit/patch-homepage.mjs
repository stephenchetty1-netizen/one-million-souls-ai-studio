import fs from 'node:fs'

const file = 'app/page.tsx'
let source = fs.readFileSync(file, 'utf8')
function replaceExactly(before, after) {
  if (!source.includes(before)) throw new Error('Zero-credit UI patch target missing: ' + before.slice(0, 90))
  source = source.replace(before, after)
}
replaceExactly('OpenAI Responses API', 'Zero-credit curated mode')
replaceExactly(
  'Research Scripture, build a devotional, run biblical and platform quality gates, then prepare the post for the One Million Souls autopilot.',
  'Prepare a draft using the existing curated Scripture ledger. Every draft needs human review. No paid AI generation or automatic publishing.'
)
replaceExactly('Create TikTok devotional <span>→</span>', 'Prepare curated devotional draft <span>→</span>')
replaceExactly('Building ministry content…', 'Preparing curated text…')
replaceExactly("'Quality passed':'Needs revision'", "'Editorial review required':'Editorial review required'")
replaceExactly(
  'Enter a topic and create a Scripture-grounded content package for the One Million Souls daily publishing engine.',
  'Choose a topic covered by the curated devotional ledger. This produces a draft only, without an AI API call.'
)
replaceExactly(
  'Generate three 9:16 visual directions. You approve everything before publishing.',
  'Editorial directions only. Source and individually review rights-cleared moving footage before any separate video-production step.'
)
replaceExactly('onClick={makeImages} disabled={imageLoading}', 'disabled={true} title="Paid image generation is disabled in zero-credit mode"')
replaceExactly('Generate images →', 'Paid image generation disabled')
replaceExactly(
  '🟢 AUTOPILOT + LEARNING</strong><span>After biblical, safety and platform checks pass, the campaign can enter the publishing queue. Performance data feeds the Growth Manager and experimentation engine.',
  '🔒 CURATED DRAFT — PUBLISHING LOCKED</strong><span>This text is sourced from the curated ledger, not newly generated. Scripture, audience fit, media quality, rights, and the exact final MP4 require separate human review and certification. No automatic posting.'
)
replaceExactly(
  'The Growth Manager will create controlled hook and opening experiments as performance data accumulates.',
  'No automatic experiments or publishing are started from this draft.'
)
replaceExactly('Browser → Next.js server → OpenAI. API key stays server-side.',
  'Browser → Next.js server → curated ledger. No paid AI API calls.')
fs.writeFileSync(file, source)
console.log('ZERO_CREDIT_UI_PATCH_APPLIED')
