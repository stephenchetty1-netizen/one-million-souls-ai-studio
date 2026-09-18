import crypto from 'node:crypto'

export const AGENTS = Object.freeze([
  { id:'trend-scout', role:'Research current Christian topics, search demand, hooks, formats, and audience patterns.', output:'trendBrief' },
  { id:'million-view-scout', role:'Find publicly verifiable TikTok/YouTube Christian content above 1M views and extract reusable format patterns without copying protected expression.', output:'millionViewPatternBrief' },
  { id:'channel-strategist', role:'Study channel positioning, content pillars, series architecture, audience promise, differentiation, and growth opportunities.', output:'channelStrategy' },
  { id:'competitor-mapper', role:'Map comparable Christian channels and creators, their recurring formats, upload patterns, audience signals, and white-space opportunities without copying.', output:'competitorMap' },
  { id:'search-intent-analyst', role:'Research YouTube/TikTok search questions, keywords, recurring viewer problems, and searchable topic clusters.', output:'searchDemandMap' },
  { id:'audience-insight-researcher', role:'Develop audience personas from comments, watch behavior, recurring questions, age/life-stage needs, and platform context.', output:'audienceInsightReport' },
  { id:'retention-scientist', role:'Study hook strength, drop-off points, pacing, scene duration, caption density, payoff timing, and rewatch triggers.', output:'retentionReport' },
  { id:'hook-lab', role:'Generate and test multiple original hook families for each concept: question, tension, promise, story, prayer, contrast, surprise, and search-intent.', output:'hookVariants' },
  { id:'format-innovation-lab', role:'Invent fresh Christian content formats by combining proven mechanics with new storytelling, visual, interactive, devotional, and community structures.', output:'formatConcepts' },
  { id:'thumbnail-researcher', role:'Study high-performing thumbnail composition, focal points, contrast, text economy, curiosity, emotion, and topic-match patterns.', output:'thumbnailResearch' },
  { id:'metadata-strategist', role:'Develop titles, descriptions, chapters, tags, hashtags, playlists, series names, and search packaging without spam or misleading claims.', output:'metadataPackage' },
  { id:'content-portfolio-planner', role:'Balance the channel across evergreen, trend-responsive, search-led, devotional, story, worship, testimony, Bible education, and experimental content.', output:'contentPortfolio' },
  { id:'executive-producer', role:'Convert approved research into a prioritized production slate with deadlines, dependencies, format assignments, and resource constraints.', output:'productionSlate' },
  { id:'storyboard-producer', role:'Turn scripts into detailed moving-video storyboards with shot purpose, pacing, transitions, B-roll needs, and visual continuity.', output:'storyboard' },
  { id:'media-producer', role:'Coordinate footage, voice, music, graphics, captions, aspect ratios, file versions, and delivery requirements across productions.', output:'mediaProductionPackage' },
  { id:'motion-editor', role:'Build or direct polished motion edits, pacing, reframing, transitions, kinetic captions, and platform-safe visual rhythm.', output:'motionEditPlan' },
  { id:'sound-designer', role:'Design music beds, ambience, impact moments, transitions, ducking, loudness, and emotional audio arcs that support narration.', output:'soundDesignPlan' },
  { id:'repurposing-editor', role:'Turn approved long-form and lyric productions into multiple original Shorts, teasers, clips, hooks, quote moments, and platform variants.', output:'repurposePackage' },
  { id:'media-librarian', role:'Maintain a rights-aware catalog of reusable footage, music, graphics, voice, thumbnails, project files, and prior successful scenes.', output:'mediaLibraryIndex' },
  { id:'production-scheduler', role:'Keep a rolling draft-production calendar, manage queue health, prevent content gaps, and ensure a consistent supply of review-ready media.', output:'productionSchedule' },
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

export const RND_AGENTS = Object.freeze([
  'trend-scout','million-view-scout','channel-strategist','competitor-mapper',
  'search-intent-analyst','audience-insight-researcher','retention-scientist',
  'hook-lab','format-innovation-lab','thumbnail-researcher','metadata-strategist',
  'content-portfolio-planner'
])

export const MEDIA_AGENTS = Object.freeze([
  'executive-producer','storyboard-producer','media-producer','motion-editor',
  'sound-designer','repurposing-editor','media-librarian','production-scheduler'
])

export const TEAM_APPROVAL_AGENT_IDS = Object.freeze(AGENTS.map((agent) => agent.id))
export const PRE_PUBLISH_APPROVAL_AGENT_IDS = Object.freeze(
  TEAM_APPROVAL_AGENT_IDS.filter((id) => id !== 'publisher')
)

export function buildApprovalMatrix(contentHash = '') {
  return Object.fromEntries(
    TEAM_APPROVAL_AGENT_IDS.map((agentId) => [
      agentId,
      {
        decision: 'PENDING',
        contentHash,
        approvedAt: null,
        notes: '',
      },
    ])
  )
}

export function verifyPrePublishConsensus(approvals = {}, contentHash = '') {
  const missing = []
  const stale = []
  const rejected = []

  for (const agentId of PRE_PUBLISH_APPROVAL_AGENT_IDS) {
    const vote = approvals?.[agentId]
    if (!vote) {
      missing.push(agentId)
      continue
    }
    if (vote.contentHash !== contentHash) stale.push(agentId)
    if (vote.decision !== 'APPROVE' || !vote.approvedAt) rejected.push(agentId)
  }

  return {
    ok: missing.length === 0 && stale.length === 0 && rejected.length === 0,
    required: PRE_PUBLISH_APPROVAL_AGENT_IDS.length,
    approved: PRE_PUBLISH_APPROVAL_AGENT_IDS.length - new Set([...missing, ...stale, ...rejected]).size,
    missing,
    stale,
    rejected,
  }
}

export function verifyUnanimousTeamApproval(approvals = {}, contentHash = '') {
  const pre = verifyPrePublishConsensus(approvals, contentHash)
  const publisher = approvals?.publisher
  const publisherApproved = Boolean(
    publisher &&
    publisher.decision === 'APPROVE' &&
    publisher.approvedAt &&
    publisher.contentHash === contentHash
  )

  const allPreTimes = PRE_PUBLISH_APPROVAL_AGENT_IDS
    .map((id) => approvals?.[id]?.approvedAt)
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter(Number.isFinite)
  const latestPreApproval = allPreTimes.length ? Math.max(...allPreTimes) : 0
  const publisherTime = publisherApproved ? Date.parse(publisher.approvedAt) : 0
  const publisherAfterTeam = publisherApproved && Number.isFinite(publisherTime) && publisherTime >= latestPreApproval

  return {
    ok: pre.ok && publisherApproved && publisherAfterTeam,
    required: TEAM_APPROVAL_AGENT_IDS.length,
    approved: pre.approved + (publisherApproved && publisherAfterTeam ? 1 : 0),
    prePublishConsensus: pre,
    publisherApproved,
    publisherAfterTeam,
  }
}

export function teamCanPublish({ qa = {}, approvals = {}, contentHash = '' } = {}) {
  const gatesPass = REQUIRED_GATES.every((gate) => qa?.[gate] === 'PASS')
  const consensus = verifyUnanimousTeamApproval(approvals, contentHash)
  return {
    ok: gatesPass && consensus.ok,
    gatesPass,
    consensus,
  }
}

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
  'professionalExecution',
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

  const base = [...RND_AGENTS,'theology-guard','script-writer','content-director','asset-scout','rights-scout','music-director','visual-director','thumbnail-director','executive-producer','storyboard-producer','media-producer','motion-editor','sound-designer','media-librarian','production-scheduler']
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

export function canPublish(qa = {}, approvals = {}, contentHash = '') {
  return teamCanPublish({ qa, approvals, contentHash }).ok
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
