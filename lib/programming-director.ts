import { getCampaignArchitecture, type CampaignArchitecture } from './campaign-architect'
import { getPerformance } from './learning'
import { decideNextContent, type NextContentDecision } from './decision-agent'

export type CalendarSlot = {
  episodeId: string
  day: number
  publishTime: string
  timezone: string
  platformPriority: 'TIKTOK_AND_YOUTUBE' | 'TIKTOK' | 'YOUTUBE'
  seriesStage: CampaignArchitecture['journey'][number]['stage']
  objective: string
  experimentMode: 'EXPLORE' | 'EXPLOIT' | 'BALANCED'
}

export type ProgrammingCalendar = {
  version: 'V31'
  generatedAt: string
  campaignId: string
  campaignTheme: string
  timezone: string
  cadence: string
  slots: CalendarSlot[]
  programmingRules: string[]
  evidence: { posts: number; measuredPosts: number; confidence: NextContentDecision['confidence'] }
  guardrails: string[]
}

const GUARDRAILS = [
  'Schedule only episodes that already pass the campaign, biblical, safety, platform, and final video quality gates.',
  'Never alter Scripture meaning or Gospel clarity to improve a calendar slot.',
  'Use aggregate/public performance signals only; never use sensitive profiling or private messages.',
  'Do not infer salvation, spiritual transformation, or personal vulnerability from engagement data.',
  'Avoid repetitive posting patterns; preserve enough spacing and series variety for sustainable programming.',
]

function defaultTime(index: number, total: number) {
  // A simple deterministic baseline that can later be replaced by platform-specific historical timing data.
  const times = total <= 7 ? ['19:00', '20:00', '19:30', '20:00', '19:00', '20:30', '19:30'] : ['18:30', '19:00', '19:30', '20:00', '20:30', '19:00', '19:30']
  return times[index % times.length]
}

function stageFor(architecture: CampaignArchitecture, day: number) {
  return architecture.episodes.find(e => e.day === day)
    ? architecture.journey[Math.min(architecture.journey.length - 1, Math.floor(((day - 1) / Math.max(architecture.episodes.length - 1, 1)) * architecture.journey.length))]
    : architecture.journey[0]
}

export async function buildProgrammingCalendar(): Promise<ProgrammingCalendar> {
  const architecture = await getCampaignArchitecture()
  if (!architecture) throw new Error('No campaign architecture is available. Build V30 campaign architecture first.')
  const [decision, records] = await Promise.all([decideNextContent(), getPerformance(150)])
  const timezone = process.env.APP_TIMEZONE || 'Africa/Johannesburg'
  const total = architecture.episodes.length
  const slots = architecture.episodes.map((episode, index) => {
    const stage = stageFor(architecture, episode.day)
    const experimentMode: CalendarSlot['experimentMode'] = index % 4 === 0 ? 'EXPLORE' : index % 3 === 0 ? 'BALANCED' : 'EXPLOIT'
    return {
      episodeId: episode.episodeId,
      day: episode.day,
      publishTime: defaultTime(index, total),
      timezone,
      platformPriority: index % 5 === 0 ? 'TIKTOK_AND_YOUTUBE' : 'TIKTOK_AND_YOUTUBE',
      seriesStage: stage.stage,
      objective: episode.objective,
      experimentMode,
    }
  })
  return {
    version: 'V31', generatedAt: new Date().toISOString(), campaignId: architecture.campaignId,
    campaignTheme: architecture.theme, timezone, cadence: 'One primary short-form episode per day; every episode is repurposed for TikTok and YouTube Shorts.',
    slots,
    programmingRules: [
      'Keep the campaign journey progressive: DISCOVER → CONNECT → DEEPEN → INVITE.',
      'Reserve controlled slots for exploration while keeping most capacity on proven patterns.',
      'Prefer consistent daily publishing over bursts of near-duplicate posts.',
      'If measured performance declines, change one major variable before changing the campaign theme.',
      `Current decision mode: ${decision.mode}. Confidence: ${decision.confidence}.`,
    ],
    evidence: { posts: records.length, measuredPosts: records.filter(r => r.views > 0).length, confidence: decision.confidence },
    guardrails: GUARDRAILS,
  }
}

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Programming calendar store failed (${response.status}).`)
  return response.json()
}

export async function saveProgrammingCalendar(calendar: ProgrammingCalendar) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return
  await redis(['set', 'one-million-souls:programming:calendar:latest', JSON.stringify(calendar)])
}

export async function getProgrammingCalendar() {
  const result = await redis(['get', 'one-million-souls:programming:calendar:latest'])
  if (!result?.result) return null
  try { return JSON.parse(result.result) as ProgrammingCalendar } catch { return null }
}

export function validateProgrammingCalendar(calendar: ProgrammingCalendar) {
  return Boolean(calendar.version === 'V31' && calendar.campaignId && calendar.campaignTheme && calendar.timezone && calendar.slots.length >= 3 && calendar.slots.every(s => s.episodeId && s.day > 0 && /^\d{2}:\d{2}$/.test(s.publishTime) && s.timezone && s.seriesStage && s.experimentMode))
}
