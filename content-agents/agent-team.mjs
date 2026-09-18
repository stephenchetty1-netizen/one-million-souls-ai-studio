import crypto from 'node:crypto'

export const AGENTS = Object.freeze([
  { id:'trend-scout', role:'Research current Christian topics, search demand, hooks, formats, and audience patterns.', output:'trendBrief' },
  { id:'million-view-scout', role:'Find publicly verifiable TikTok/YouTube Christian content above 1M views and extract reusable format patterns without copying protected expression.', output:'millionViewPatternBrief' },
  { id:'rights-scout', role:'Verify item-level usage rights and block ambiguous assets.', output:'rightsLedger' },
  { id:'theology-guard', role:'Check Scripture references, context, quotations, and doctrine-sensitive claims.', output:'theologyReport' },
  { id:'script-writer', role:'Write original Shorts and long-form scripts from approved briefs.', output:'scriptPackage' },
  { id:'asset-scout', role:'Find licensed realistic moving footage first; images only when necessary.', output:'assetPlan' },
  { id:'music-director', role:'Select or generate legally usable music and sound design.', output:'audioPlan' },
  { id:'visual-director', role:'Create shot list, captions, typography, color, motion, transitions, and overall modern visual language.', output:'visualPlan' },
  { id:'thumbnail-director', role:'Create clean, high-contrast, mobile-first thumbnails/covers with one clear focal point, minimal text, and truthful curiosity.', output:'thumbnailPackage' },
  { id:'content-director', role:'Review every concept and script for accuracy, modern relevance, motivation, clarity, emotional pull, pacing, and originality without sensationalism.', output:'contentReview' },
  { id:'shorts-editor', role:'Build 9:16 short-form edit plan optimized for hook and retention.', output:'shortEdit' },
  { id:'longform-producer', role:'Build 16:9 long-form structure plus B-roll and Shorts cutdowns.', output:'longEdit' },
  { id:'lyric-producer', role:'Build lyric video only from original/user-owned/verified public-domain material and produce phrase-level lyric timing derived from the actual vocal track.', output:'lyricEdit' },
  { id:'qa', role:'Run rights, theology, factual, media, caption, audio, visual, originality, and platform checks.', output:'qaReport' },
  { id:'publisher', role:'Publish only when every required gate passes.', output:'publishResult' },
  { id:'analytics-learner', role:'Read performance and generate lessons for the next content cycle.', output:'learningReport' },
])

export const REQUIRED_GATES = Object.freeze([
  'rightsStatus',
  'theologyStatus',
  'factualStatus',
  'mediaIntegrity',
  'captionSync',
  'audioMix',
  'visualQuality',
  'thumbnailQuality',
  'contentQuality',
  'lyricSync',
  'originality',
])

export const SOURCE_PRIORITY = Object.freeze([
  'pexels',
  'pixabay',
  'mixkit',
  'youtube-audio-library',
  'unsplash',
  'wikimedia-commons',
  'internet-archive',
])

export function normalizeMode(value='SHORT') {
  const mode = String(value).toUpperCase()
  if (!['SHORT','LONG','LYRIC'].includes(mode)) throw new Error('Unsupported content mode')
  return mode
}

export function createRunPlan(input={}) {
  const mode = normalizeMode(input.mode || 'SHORT')
  const topic = String(input.topic || '').trim()
  if (!topic) throw new Error('topic is required')

  const base = ['trend-scout','million-view-scout','theology-guard','script-writer','content-director','asset-scout','rights-scout','music-director','visual-director','thumbnail-director']
  const editor = mode === 'SHORT' ? 'shorts-editor' : mode === 'LONG' ? 'longform-producer' : 'lyric-producer'

  return {
    runId: input.runId || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mode,
    topic,
    audience: input.audience || 'Christian social media audience',
    platforms: input.platforms || ['youtube','tiktok'],
    agents: [...base, editor, 'qa', 'publisher', 'analytics-learner'],
    publishingLocked: true,
    rightsDefault: 'BLOCK',
    originalityRule: 'Learn from format and performance patterns; do not copy protected expression.',
  }
}

export function rightsDecision(record={}) {
  if (record.rightsStatus === 'BLOCK') return 'BLOCK'
  if (record.rightsStatus !== 'PASS') return 'REVIEW'
  if (record.commercialUseAllowed !== true && record.publicDomain !== true) return 'REVIEW'
  if (!record.sourceUrl || !record.checkedAt) return 'REVIEW'
  return 'PASS'
}

export function canPublish(qa={}) {
  return REQUIRED_GATES.every((gate) => qa[gate] === 'PASS')
}

export function buildQaTemplate() {
  return Object.fromEntries(REQUIRED_GATES.map((gate) => [gate, 'PENDING']))
}

export function contentSpec(mode='SHORT') {
  mode = normalizeMode(mode)
  if (mode === 'SHORT') return {
    aspect:'9:16', targetSeconds:[15,45], hookWindowSeconds:1.0,
    assetPreference:'moving-video-first', captionWordsPerBeat:[2,5], thumbnailTextWords:[0,4], thumbnailVariants:2,
  }
  if (mode === 'LONG') return {
    aspect:'16:9', targetMinutes:[4,12], hookWindowSeconds:12,
    assetPreference:'moving-video-first', chapters:true, shortsCutdowns:true, thumbnailTextWords:[2,5], thumbnailVariants:3,
  }
  return {
    aspect:'9:16-or-16:9', rightsRule:'original-user-owned-or-verified-public-domain-only',
    phraseLevelLyricSync:true, lyricTimingSource:'actual-vocal-track', lyricSyncToleranceMs:80, movingBackgroundVideoPreferred:true, thumbnailVariants:2,
  }
}
