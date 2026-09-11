import { getPerformance, getStrategy, type PerformanceRecord } from './learning'
import { getAudienceProfile } from './audience'
import { getExperiments } from './experiments'

export type CreativeDirection = {
  generatedAt: string
  directionId: string
  hookStyle: string
  storyStyle: string
  scripturePresentation: string
  visualStyle: string
  ctaStyle: string
  platformPriority: 'TikTok' | 'YouTube Shorts' | 'Balanced'
  reason: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  exploration: boolean
  evidence: { posts: number; topHooks: string[]; topTopics: string[] }
  guardrails: string[]
}

const DIRECTIONS = [
  { id: 'truth-first', hookStyle: 'Start with a direct, surprising faith truth.', storyStyle: 'Use a concise real-life tension before resolving it with Scripture.', scripturePresentation: 'Show the reference early, then explain the key truth in plain language.', visualStyle: 'Cinematic, calm, symbolic Christian imagery with strong text contrast.', ctaStyle: 'Invite the viewer to save and share the message with someone who needs it.' },
  { id: 'question-first', hookStyle: 'Open with a question the viewer may already be asking.', storyStyle: 'Move from the question to a short relatable scenario and then to biblical hope.', scripturePresentation: 'Reveal one central Scripture after the tension is established.', visualStyle: 'Fast opening text, expressive movement, then a calmer Scripture moment.', ctaStyle: 'Invite a thoughtful comment or prayer response without pressure.' },
  { id: 'prayer-first', hookStyle: 'Open with a one-line prayer or invitation to pause.', storyStyle: 'Frame the message as a short prayerful journey from burden to trust.', scripturePresentation: 'Use one Scripture as the foundation of the prayer and clearly identify it.', visualStyle: 'Warm, reflective worship-adjacent atmosphere without using copyrighted lyrics.', ctaStyle: 'Invite viewers to pray along and share with someone who needs prayer.' },
  { id: 'jesus-centered', hookStyle: 'Lead immediately with what Jesus means for the viewer today.', storyStyle: 'Use a concise problem-to-Gospel arc: struggle, Jesus, hope, response.', scripturePresentation: 'Center the passage on its biblical context and connection to Jesus without forcing a connection.', visualStyle: 'Bold Christian imagery, clean typography, purposeful visual transitions.', ctaStyle: 'Invite the viewer to follow for more Scripture-grounded encouragement.' },
]

function score(record: PerformanceRecord) {
  const retention = (record.avgPercentageViewed ?? 0) / 100
  const engagement = record.views ? (record.likes + record.comments + record.shares) / record.views : 0
  const follows = record.views ? record.follows / record.views : 0
  return Math.min(record.views / 10000, 3) * 0.45 + retention * 0.25 + Math.min(engagement * 20, 1) * 0.15 + Math.min(follows * 100, 1) * 0.15
}

function top(records: PerformanceRecord[], key: 'hook' | 'topic') {
  const map = new Map<string, { score: number; count: number }>()
  for (const r of records) {
    const value = r[key]
    if (!value) continue
    const cur = map.get(value) || { score: 0, count: 0 }
    cur.score += score(r); cur.count++
    map.set(value, cur)
  }
  return [...map.entries()].sort((a,b) => b[1].score / b[1].count - a[1].score / a[1].count).slice(0,5).map(([v]) => v)
}

export async function makeCreativeDirection(): Promise<CreativeDirection> {
  const [records, strategy, audience, experiments] = await Promise.all([getPerformance(150), getStrategy(), getAudienceProfile(), getExperiments(30)])
  const topHooks = top(records, 'hook')
  const topTopics = top(records, 'topic')
  const active = experiments.find(e => e.status !== 'COMPLETED')
  const index = records.length ? Math.min(Math.floor(records.length / 8), DIRECTIONS.length - 1) : 0
  const direction = DIRECTIONS[index]
  const audienceHint = audience?.recommendedAngles?.[0]
  const strategyHint = strategy?.winningHooks?.[0]
  const exploration = records.length < 12 || !topHooks.length
  const confidence: CreativeDirection['confidence'] = records.length >= 30 ? 'HIGH' : records.length >= 12 ? 'MEDIUM' : 'LOW'
  return {
    generatedAt: new Date().toISOString(),
    directionId: active ? `experiment-${active.id}-${direction.id}` : direction.id,
    hookStyle: strategyHint ? `Prefer the proven hook pattern “${strategyHint}”, then apply this direction: ${direction.hookStyle}` : direction.hookStyle,
    storyStyle: direction.storyStyle,
    scripturePresentation: direction.scripturePresentation,
    visualStyle: direction.visualStyle,
    ctaStyle: audienceHint ? `${direction.ctaStyle} Audience signal to respect: ${audienceHint}` : direction.ctaStyle,
    platformPriority: records.length >= 20 ? (records.filter(r => r.platform === 'tiktok').length > records.filter(r => r.platform === 'youtube').length ? 'TikTok' : 'YouTube Shorts') : 'Balanced',
    reason: exploration ? 'Creative data is still developing, so the engine deliberately explores a clear creative direction rather than overfitting to sparse results.' : 'Direction balances observed performance with controlled creative exploration and audience demand.',
    confidence,
    exploration,
    evidence: { posts: records.length, topHooks, topTopics },
    guardrails: [
      'Scripture accuracy and biblical context outrank creative performance.',
      'Never fabricate Bible quotations, references, testimonies, or claims.',
      'Do not use fear, deception, shame, or guaranteed outcomes as growth tactics.',
      'Creative direction may change packaging, not the verified biblical truth.',
      'Keep experimentation attributable so results can be learned from later.',
    ],
  }
}

export function validateCreativeDirection(d: CreativeDirection) {
  return Boolean(d.directionId && d.hookStyle && d.storyStyle && d.scripturePresentation && d.visualStyle && d.ctaStyle && d.guardrails.length >= 4)
}
