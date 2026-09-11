import { getPerformance, type PerformanceRecord } from './learning'
import { getNextContentDecision } from './decision-agent'
import { getAgentSupervisorSnapshot } from './agent-supervisor'

export type MemoryLessonType = 'WIN' | 'LOSS' | 'PATTERN' | 'GUARDRAIL' | 'DECISION'
export type MemoryLesson = {
  id: string
  createdAt: string
  type: MemoryLessonType
  statement: string
  evidence: string[]
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  reusable: boolean
  tags: string[]
}

export type AgentMemorySnapshot = {
  version: 'V38'
  generatedAt: string
  totalLessons: number
  durablePrinciples: string[]
  lessons: MemoryLesson[]
  latestDecision?: string
  latestSupervisorAction?: string
  guardrails: string[]
}

const KEY = 'one-million-souls:agent-memory:latest'
const GUARDRAILS = [
  'Memory records experience; it is never a substitute for verified Scripture or biblical context.',
  'Only aggregate/public performance and system decisions may be stored. Never store private messages, sensitive traits, or personal circumstances.',
  'Never preserve fabricated testimony, claims, quotations, statistics, or spiritual guarantees as lessons.',
  'A lesson is evidence-weighted and reversible; weak evidence must not become a permanent rule.',
  'Memory cannot bypass safety, rights, platform, quality, or human-controlled deployment gates.',
]

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Agent memory store failed (${response.status}).`)
  return response.json()
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a,b) => a-b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2
}

function lessonFromRecords(records: PerformanceRecord[]): MemoryLesson[] {
  const measured = records.filter(r => r.views > 0)
  if (measured.length < 6) return []
  const medViews = median(measured.map(r => r.views))
  const medRetention = median(measured.map(r => r.avgPercentageViewed || 0))
  const lessons: MemoryLesson[] = []
  const winners = measured.filter(r => r.views >= medViews * 1.2 && (r.avgPercentageViewed || 0) >= medRetention * 1.05).slice(0, 5)
  const weak = measured.filter(r => r.views <= medViews * 0.8).slice(0, 5)

  if (winners.length) {
    const topics = [...new Set(winners.map(r => r.topic).filter(Boolean))] as string[]
    const hooks = [...new Set(winners.map(r => r.hook).filter(Boolean))] as string[]
    lessons.push({
      id: `win-${Date.now()}`, createdAt: new Date().toISOString(), type: 'WIN',
      statement: 'Recent high-performing posts suggest a repeatable combination of strong reach and retention.',
      evidence: [`${winners.length} recent posts exceeded the view and retention thresholds.`, topics.length ? `Topic families observed: ${topics.slice(0,3).join(', ')}.` : 'Topic metadata was limited.', hooks.length ? `Hook patterns observed: ${hooks.slice(0,2).join(' | ')}.` : 'Hook metadata was limited.'],
      confidence: measured.length >= 20 ? 'HIGH' : measured.length >= 10 ? 'MEDIUM' : 'LOW', reusable: true,
      tags: ['performance','winning-pattern','retention'],
    })
  }
  if (weak.length) lessons.push({
    id: `loss-${Date.now()}`, createdAt: new Date().toISOString(), type: 'LOSS',
    statement: 'Some recent posts underperformed relative to the current baseline; avoid assuming the same packaging will work unchanged.',
    evidence: [`${weak.length} posts were at or below 80% of the current median views.`, `Current median views: ${Math.round(medViews)}.`],
    confidence: measured.length >= 20 ? 'HIGH' : 'MEDIUM', reusable: true, tags: ['performance','underperformance','testing'],
  })
  return lessons
}

function durablePrinciples(lessons: MemoryLesson[]) {
  const principles = [
    'Keep Jesus and the Gospel central while optimizing communication rather than changing biblical truth.',
    'Use measured evidence before turning a creative pattern into a repeatable strategy.',
    'Prefer controlled experiments: change one major variable at a time when evidence is limited.',
  ]
  if (lessons.some(l => l.type === 'WIN')) principles.push('Preserve winning ingredients, then test controlled variations instead of copying posts verbatim.')
  if (lessons.some(l => l.type === 'LOSS')) principles.push('Treat underperformance as a testing signal, not as proof that the mission or message has failed.')
  return principles
}

export async function buildAgentMemorySnapshot(): Promise<AgentMemorySnapshot> {
  const [records, decision, supervisor] = await Promise.all([getPerformance(60), getNextContentDecision(), getAgentSupervisorSnapshot()])
  const lessons = lessonFromRecords(records)
  if (decision) lessons.push({
    id: `decision-${Date.now()}`, createdAt: new Date().toISOString(), type: 'DECISION',
    statement: `The latest decision mode is ${decision.mode}; preserve: ${decision.preserve.slice(0,2).join(' / ')}.`,
    evidence: [decision.reason, `Confidence: ${decision.confidence}.`, `Measured posts: ${decision.evidence.measuredPosts}.`],
    confidence: decision.confidence, reusable: true, tags: ['decision','strategy'],
  })
  const unique = lessons.slice(-12)
  return {
    version: 'V38', generatedAt: new Date().toISOString(), totalLessons: unique.length,
    durablePrinciples: durablePrinciples(unique), lessons: unique,
    latestDecision: decision ? `${decision.mode}: ${decision.topic || 'no topic selected'}` : undefined,
    latestSupervisorAction: supervisor?.action,
    guardrails: GUARDRAILS,
  }
}

export async function saveAgentMemorySnapshot(snapshot: AgentMemorySnapshot) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error('Persistent state is required for durable agent memory.')
  await redis(['set', KEY, JSON.stringify(snapshot)])
}

export async function getAgentMemorySnapshot(): Promise<AgentMemorySnapshot | null> {
  const result = await redis(['get', KEY])
  if (!result?.result) return null
  try { return JSON.parse(result.result) as AgentMemorySnapshot } catch { return null }
}

export function validateAgentMemorySnapshot(snapshot: AgentMemorySnapshot) {
  return snapshot.version === 'V38' && Boolean(snapshot.generatedAt) && snapshot.durablePrinciples.length >= 3 && snapshot.guardrails.length >= 5
}
